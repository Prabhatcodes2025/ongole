
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { requestIp } from "@/src/lib/request";
import { canManagePropertyMedia } from "@/src/lib/properties/media-authorization";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

const ALLOWED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DISPLAY_WIDTH = 1200;
const DISPLAY_HEIGHT = 800;
const THUMB_WIDTH = 600;
const THUMB_HEIGHT = 400;

const WATERMARK_TEXT =
  "www.ongoleproperty.com , call : 7788998459";

function dashboardUrl(
  request: NextRequest,
  propertyId: string,
  result: string
) {
  if (request.nextUrl.searchParams.get("returnTo") === "admin") {
    return new URL(
      `/admin/properties/${propertyId}/edit?media=${result}`,
      request.url
    );
  }

  const pgId =
    request.nextUrl.searchParams.get("context") === "pg"
      ? request.nextUrl.searchParams.get("pgId")
      : null;

  if (pgId && /^[0-9a-f-]{36}$/i.test(pgId)) {
    return new URL(
      `/dashboard/pg/${pgId}?media=${result}`,
      request.url
    );
  }

  return new URL(
    `/dashboard/properties/${propertyId}?media=${result}`,
    request.url
  );
}

function createWatermark(width: number, height: number): Buffer {
  const margin = Math.max(12, Math.round(width * 0.015));
  const boxWidth = Math.min(850, width - margin * 2);
  const boxHeight = Math.min(64, height - margin * 2);

  const fontSize = Math.max(
    8,
    Math.min(21, Math.floor(boxWidth / 40), Math.floor(boxHeight * 0.38))
  );

  const svg = `
    <svg
      width="${boxWidth}"
      height="${boxHeight}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        width="100%"
        height="100%"
        rx="8"
        fill="#111827"
        fill-opacity="0.65"
      />
      <text
        x="50%"
        y="50%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="#ffffff"
      >${WATERMARK_TEXT}</text>
    </svg>
  `;

  return Buffer.from(svg);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const isPg = request.nextUrl.searchParams.get("context") === "pg";

  const rate = await checkRateLimit(
    `upload:${requestIp(request)}`,
    20,
    60 * 60_000
  );

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Upload limit reached. Try again later." },
      { status: 429 }
    );
  }

  if (!env.isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase storage is not configured." },
      { status: 503 }
    );
  }

  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.redirect(
      new URL(`/login?returnTo=/dashboard/properties/${id}`, request.url),
      303
    );
  }

  if (!auth.user.email_confirmed_at) {
    return NextResponse.json(
      {
        error:
          "Verify your email address before uploading property images.",
      },
      { status: 403 }
    );
  }

  const { data: ownedProperty } = await supabase
    .from("properties")
    .select("id,status,owner_id")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  let property = ownedProperty;

  let canManage = canManagePropertyMedia({
    isOwner: Boolean(ownedProperty),
    ownerEditable: Boolean(
      ownedProperty &&
        ["draft", "changes_requested"].includes(ownedProperty.status)
    ),
    hasPropertiesManage: false,
    hasPgManage: false,
    isPgListing: false,
    requestedPgContext: isPg,
  });

  if (!property) {
    const [
      { data: adminProperty },
      { data: propertiesManage },
      { data: pgManage },
      { data: pgListing },
    ] = await Promise.all([
      supabase
        .from("properties")
        .select("id,status,owner_id")
        .eq("id", id)
        .maybeSingle(),

      supabase.rpc("has_permission", {
        required_permission: "properties.manage",
      }),

      supabase.rpc("has_permission", {
        required_permission: "pg.manage",
      }),

      supabase
        .from("pg_listings")
        .select("id")
        .eq("property_id", id)
        .maybeSingle(),
    ]);

    canManage = canManagePropertyMedia({
      isOwner: false,
      ownerEditable: false,
      hasPropertiesManage: propertiesManage === true,
      hasPgManage: pgManage === true,
      isPgListing: Boolean(pgListing),
      requestedPgContext: isPg,
    });

    property =
      adminProperty ||
      (pgListing ? { id, status: "", owner_id: "" } : null);
  }

  if (!property || !canManage) {
    return NextResponse.json(
      { error: "This property cannot accept uploads." },
      { status: 403 }
    );
  }

  const form = await request.formData();

  const files = form
    .getAll("image")
    .filter(
      (item): item is File =>
        item instanceof File && item.size > 0
    );

  if (
    !files.length ||
    files.length > 6 ||
    files.some(
      (file) =>
        file.size > MAX_SOURCE_BYTES ||
        !ALLOWED_INPUT_TYPES.has(file.type)
    )
  ) {
    return NextResponse.redirect(
      dashboardUrl(request, id, "invalid"),
      303
    );
  }

  const { count } = await supabase
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("property_id", id)
    .eq("media_type", "image");

  const limit = 6;

  if ((count ?? 0) + files.length > limit) {
    return NextResponse.redirect(
      dashboardUrl(request, id, "limit"),
      303
    );
  }

  const storedPaths: string[] = [];
  const storedIds: string[] = [];

  try {
    const { default: sharp } = await import("sharp");

    for (const [index, file] of files.entries()) {
      const source = Buffer.from(await file.arrayBuffer());

      // Normalize orientation and crop to website dimensions.
      const baseImage = sharp(source, {
        failOn: "warning",
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          fit: "cover",
          position: "attention",
        });

      const normalized = await baseImage
        .toBuffer({ resolveWithObject: true });

      if (!normalized.info.width || !normalized.info.height) {
        throw new Error("Image dimensions unavailable");
      }

      // Apply watermark to all property and PG images.
      const watermark = createWatermark(
        normalized.info.width,
        normalized.info.height
      );

      const processed = await sharp(normalized.data)
        .composite([
          {
            input: watermark,
            gravity: "southeast",
          },
        ])
        .webp({
          quality: 85,
          effort: 5,
        })
        .toBuffer();

      const output = await sharp(processed).metadata();

      // Create standardized thumbnail.
      const thumbnail = await sharp(processed)
        .resize({
          width: THUMB_WIDTH,
          height: THUMB_HEIGHT,
          fit: "cover",
        })
        .webp({
          quality: 80,
          effort: 5,
        })
        .toBuffer();

      const thumbnailOutput = await sharp(thumbnail).metadata();

      const mediaId = crypto.randomUUID();

      const path =
        `${auth.user.id}/${id}/${mediaId}.webp`;

      const thumbnailPath =
        `${auth.user.id}/${id}/${mediaId}-thumb.webp`;

      // Upload display image.
      const { error: uploadError } = await supabase.storage
        .from("property-media")
        .upload(path, processed, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      storedPaths.push(path);

      // Upload thumbnail.
      const { error: thumbnailUploadError } = await supabase.storage
        .from("property-media")
        .upload(thumbnailPath, thumbnail, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });

      if (thumbnailUploadError) {
        throw thumbnailUploadError;
      }

      storedPaths.push(thumbnailPath);

      // Save image information.
      const { error: recordError } = await supabase
        .from("property_media")
        .insert({
          id: mediaId,
          property_id: id,
          storage_path: path,
          original_filename: file.name.slice(0, 255),
          mime_type: "image/webp",
          byte_size: processed.byteLength,
          width: output.width,
          height: output.height,
          processing_status: "ready",
          is_cover:
            !isPg && (count ?? 0) === 0 && index === 0,
          sort_order: (count ?? 0) + index,
          variants: {
            display: {
              path,
              width: output.width,
              height: output.height,
              format: "webp",
            },
            thumbnail: {
              path: thumbnailPath,
              width: thumbnailOutput.width,
              height: thumbnailOutput.height,
              format: "webp",
              byte_size: thumbnail.byteLength,
            },
          },
        });

      if (recordError) {
        throw recordError;
      }

      storedIds.push(mediaId);
    }

    await supabase.rpc("record_audit_event", {
      event_action: "media.upload",
      event_type: "property_media",
      event_reference: id,
      event_new: {
        media_ids: storedIds,
        count: storedIds.length,
        context: isPg ? "pg" : "property",
      },
    });

    return NextResponse.redirect(
      dashboardUrl(request, id, "uploaded"),
      303
    );
  } catch (error) {
    if (storedPaths.length) {
      await supabase.storage
        .from("property-media")
        .remove(storedPaths);
    }

    if (storedIds.length) {
      await supabase
        .from("property_media")
        .delete()
        .in("id", storedIds);
    }

    console.error("Property image processing failed", {
      propertyId: id,
      error,
    });

    return NextResponse.redirect(
      dashboardUrl(request, id, "failed"),
      303
    );
  }
}
