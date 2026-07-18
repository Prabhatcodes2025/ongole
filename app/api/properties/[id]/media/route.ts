import { NextRequest, NextResponse } from "next/server";
import { env } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {requestIp} from "@/src/lib/request";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const ALLOWED_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function dashboardUrl(request: NextRequest, propertyId: string, result: string) {
  return new URL(`/dashboard/properties/${propertyId}?media=${result}`, request.url);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rate=await checkRateLimit(`upload:${requestIp(request)}`,20,60*60_000);if(!rate.allowed)return NextResponse.json({error:"Upload limit reached. Try again later."},{status:429});
  if (!env.isSupabaseConfigured) return NextResponse.json({ error: "Supabase storage is not configured." }, { status: 503 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL(`/login?returnTo=/dashboard/properties/${id}`, request.url), 303);
  const { data: property } = await supabase.from("properties").select("id,status").eq("id", id).eq("owner_id", auth.user.id).single();
  if (!property || !["draft", "changes_requested"].includes(property.status)) return NextResponse.json({ error: "This property cannot accept uploads." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File) || !file.size || file.size > MAX_SOURCE_BYTES || !ALLOWED_INPUT_TYPES.has(file.type)) return NextResponse.redirect(dashboardUrl(request, id, "invalid"), 303);
  const { count } = await supabase.from("property_media").select("id", { count: "exact", head: true }).eq("property_id", id).eq("media_type", "image");
  if ((count ?? 0) >= 20) return NextResponse.redirect(dashboardUrl(request, id, "limit"), 303);

  try {
    // Loaded only for an authenticated upload. This keeps the public worker
    // bundle bootable while the Node.js VPS runtime provides native Sharp.
    const { default: sharp } = await import("sharp");
    const source = Buffer.from(await file.arrayBuffer());
    const baseImage = sharp(source, { failOn: "warning", limitInputPixels: 40_000_000 }).rotate().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true });
    const dimensions = await baseImage.clone().metadata();
    if (!dimensions.width || !dimensions.height) throw new Error("Image dimensions unavailable");
    const watermarkWidth = Math.max(210, Math.min(560, Math.round(dimensions.width * 0.34)));
    const watermarkHeight = Math.max(38, Math.round(watermarkWidth * 0.115));
    const watermark = Buffer.from(`<svg width="${watermarkWidth}" height="${watermarkHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="8" fill="#111827" fill-opacity="0.62"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${Math.round(watermarkHeight * 0.35)}" font-weight="700" letter-spacing="1" fill="#ffffff">ONGOLEPROPERTY.COM</text></svg>`);
    const processed = await baseImage.composite([{ input: watermark, gravity: "southeast" }]).webp({ quality: 84, effort: 5 }).toBuffer();
    const output = await sharp(processed).metadata();
    const thumbnail = await sharp(processed).resize({ width: 480, height: 360, fit: "cover", position: "centre", withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toBuffer();
    const thumbnailOutput = await sharp(thumbnail).metadata();
    const mediaId = crypto.randomUUID();
    const path = `${auth.user.id}/${id}/${mediaId}.webp`;
    const thumbnailPath = `${auth.user.id}/${id}/${mediaId}-thumb.webp`;
    const { error: uploadError } = await supabase.storage.from("property-media").upload(path, processed, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;
    const { error: thumbnailUploadError } = await supabase.storage.from("property-media").upload(thumbnailPath, thumbnail, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (thumbnailUploadError) {await supabase.storage.from("property-media").remove([path]);throw thumbnailUploadError;}
    const { error: recordError } = await supabase.from("property_media").insert({ id: mediaId, property_id: id, storage_path: path, original_filename: file.name.slice(0, 255), mime_type: "image/webp", byte_size: processed.byteLength, width: output.width, height: output.height, processing_status: "ready", is_cover: (count ?? 0) === 0, sort_order: count ?? 0, variants: { display: { path, width: output.width, height: output.height, format: "webp" }, thumbnail: { path:thumbnailPath,width:thumbnailOutput.width,height:thumbnailOutput.height,format:"webp",byte_size:thumbnail.byteLength } } });
    if (recordError) { await supabase.storage.from("property-media").remove([path,thumbnailPath]); throw recordError; }
    await supabase.rpc("record_audit_event",{event_action:"media.upload",event_type:"property_media",event_reference:id,event_new:{media_id:mediaId,storage_path:path}});
    return NextResponse.redirect(dashboardUrl(request, id, "uploaded"), 303);
  } catch (error) {
    console.error("Property image processing failed", { propertyId: id, error });
    return NextResponse.redirect(dashboardUrl(request, id, "failed"), 303);
  }
}
