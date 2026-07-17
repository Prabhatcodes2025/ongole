import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { requestData } from "@/src/lib/request";
import { propertySlug } from "@/src/lib/seo/slug";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {verifyCaptcha} from "@/src/lib/security/captcha";
import {requestIp} from "@/src/lib/request";

const schema = z.object({ transactionType: z.enum(["sale","rent","lease"]), category: z.string().min(2).max(60), propertyType: z.string().trim().min(2).max(80), title: z.string().trim().min(10).max(120), description: z.string().trim().min(40).max(10000), locality: z.string().trim().min(2).max(120), city: z.string().trim().min(2).max(120), district: z.string().trim().min(2).max(120), state: z.string().trim().min(2).max(120), price: z.coerce.number().nonnegative(), areaValue: z.coerce.number().positive(), areaUnit: z.enum(["gadi","sq_ft","sq_yd","sq_m","acre","cent","gunta","hectare"]), declaration: z.literal("accepted") });

export async function POST(request: NextRequest) {
  const ip=requestIp(request);const rate=await checkRateLimit(`property-create:${ip}`,8,60*60_000);if(!rate.allowed)return NextResponse.json({error:"Too many property submissions. Try again later."},{status:429});
  if (!env.isSupabaseConfigured) return NextResponse.json({ error: "Property storage is not configured yet. Add the Supabase environment values." }, { status: 503 });
  const payload=await requestData(request);const token=typeof payload["cf-turnstile-response"]==="string"?payload["cf-turnstile-response"]:null;if(!await verifyCaptcha(token,ip))return NextResponse.json({error:"CAPTCHA verification failed."},{status:400});const parsed = schema.safeParse(payload); if (!parsed.success) return NextResponse.json({ error: "Please complete all required property fields.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const supabase = await createSupabaseServerClient(); const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.redirect(new URL("/login?returnTo=/post-property", request.url), 303);
  const value = parsed.data; const baseSlug = propertySlug({ title: value.title, transactionType: value.transactionType, locality: value.locality, city: value.city });
  const propertyTypeSlug=value.propertyType.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
  const [{data:category},{data:propertyType}]=await Promise.all([supabase.from("property_categories").select("id").eq("slug",value.category).maybeSingle(),supabase.from("property_types").select("id").eq("slug",propertyTypeSlug).maybeSingle()]);
  const { data, error } = await supabase.from("properties").insert({ owner_id: auth.user.id, category_id:category?.id||null, property_type_id:propertyType?.id||null, transaction_type: value.transactionType, title: value.title, description: value.description, slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`, status: "draft", locality_text: value.locality, city_text: value.city, district_text: value.district, state_text: value.state, price_inr: value.price, area_value: value.areaValue, area_unit: value.areaUnit, details: { category: value.category, property_type: value.propertyType, property_type_slug:propertyTypeSlug, declaration_accepted_at: new Date().toISOString() } }).select("reference_no").single();
  if (error) return NextResponse.json({ error: "The property draft could not be created." }, { status: 500 });
  await supabase.rpc("record_audit_event",{event_action:"property.create",event_type:"property",event_reference:data.reference_no,event_new:{title:value.title,status:"draft"}});
  return NextResponse.redirect(new URL(`/dashboard?created=${encodeURIComponent(data.reference_no)}`, request.url), 303);
}
