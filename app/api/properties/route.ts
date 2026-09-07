import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { requestData } from "@/src/lib/request";
import { propertySlug } from "@/src/lib/seo/slug";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {verifyCaptcha} from "@/src/lib/security/captcha";
import {requestIp} from "@/src/lib/request";
import {logEvent} from "@/src/lib/observability/logger";
import {applicablePropertyDetails,propertyDescriptionIsPublicSafe,propertyTitleIsProductionSafe,propertyTypeSlug as normalizePropertyTypeSlug} from "@/src/lib/properties/validation";
import {youtubeVideoId} from "@/src/lib/youtube";

const schema = z.object({ transactionType: z.enum(["sale","rent","lease"]), category: z.string().min(2).max(60), propertyType: z.string().trim().min(2).max(80), title: z.string().trim().min(10).max(120).refine(propertyTitleIsProductionSafe,"Remove placeholder, script or database-command content from the title."), description: z.string().trim().min(40).max(10000).refine(propertyDescriptionIsPublicSafe,"Remove contact details, links, social handles, scripts or database commands from the description."), locality: z.string().trim().min(2).max(120), city: z.string().trim().min(2).max(120), district: z.string().trim().min(2).max(120), state: z.string().trim().min(2).max(120), price: z.coerce.number().nonnegative(), areaValue: z.coerce.number().positive(), areaUnit: z.enum(["gadi","sq_ft","sq_yd","sq_m","acre","cent","gunta","hectare"]), declaration: z.literal("accepted"),draftKey:z.string().uuid() }).passthrough();

export async function POST(request: NextRequest) {
  const requestId=request.headers.get("x-request-id")||crypto.randomUUID();
  const wantsJson=request.headers.get("accept")?.includes("application/json")===true;
  const ip=requestIp(request);const rate=await checkRateLimit(`property-create:${ip}`,8,60*60_000);if(!rate.allowed)return NextResponse.json({error:"Too many property submissions. Try again later."},{status:429});
  if (!env.isSupabaseConfigured) return NextResponse.json({ error: "Property storage is not configured yet. Add the Supabase environment values." }, { status: 503 });
  const supabase = await createSupabaseServerClient(); const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({error:"Authentication required. Sign in through the property-posting workflow."},{status:401});
  if(!auth.user.email_confirmed_at)return NextResponse.json({error:"Verify your email address before creating a property draft."},{status:403});
  const payload=await requestData(request);const token=typeof payload["cf-turnstile-response"]==="string"?payload["cf-turnstile-response"]:null;if(!await verifyCaptcha(token,ip))return NextResponse.json({error:"CAPTCHA verification failed."},{status:400});const parsed = schema.safeParse(payload); if (!parsed.success) return NextResponse.json({ error: "Please complete all required property fields.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const {data:permission,error:permissionError}=await supabase.rpc("check_property_posting_permission");
  const permissionResult=permission as {allowed?:boolean;consumed?:number;limit?:number}|null;
  if(permissionError||!permissionResult?.allowed)return NextResponse.json({error:"LISTING_LIMIT_REACHED",message:"ONE FREE PROPERTY PER REGISTERED USER. Contact OngoleProperty.com for one additional posting permission.",usage:permissionResult},{status:409});
  const value = parsed.data;const applicable=applicablePropertyDetails(value,value.transactionType,value.propertyType);if(!applicable.valid)return NextResponse.json({error:"Complete the fields applicable to this property type.",fields:applicable.errors},{status:400});const youtubeUrl=typeof value.youtubeUrl==="string"?value.youtubeUrl.trim():"";if(youtubeUrl&&!youtubeVideoId(youtubeUrl))return NextResponse.json({error:"Enter a supported YouTube video URL."},{status:400});const baseSlug = propertySlug({ title: value.title, transactionType: value.transactionType, locality: value.locality, city: value.city });
  const propertyTypeSlug=normalizePropertyTypeSlug(value.propertyType);
  const [{data:category},{data:propertyType}]=await Promise.all([supabase.from("property_categories").select("id").eq("slug",value.category).maybeSingle(),supabase.from("property_types").select("id,name,slug").eq("slug",propertyTypeSlug).maybeSingle()]);
  if(!category||!propertyType)return NextResponse.json({error:"Choose an active property category and type."},{status:400});
  const existing=await supabase.from("properties").select("id,reference_no").eq("owner_id",auth.user.id).contains("details",{client_draft_key:value.draftKey}).is("deleted_at",null).maybeSingle();
  if(existing.data){const editUrl=`/dashboard/properties/${existing.data.id}`;return NextResponse.json({id:existing.data.id,referenceNo:existing.data.reference_no,editUrl,reused:true},{status:200})}
  const insertPayload={ owner_id: auth.user.id, category_id:category.id, property_type_id:propertyType.id, transaction_type: value.transactionType, title: value.title, description: value.description, slug: `${baseSlug}-${crypto.randomUUID()}`, status: "draft" as const, locality_text: value.locality, city_text: value.city, district_text: value.district, state_text: value.state, price_inr: value.price, area_value: value.areaValue, area_unit: value.areaUnit, details: { ...applicable.details,category:value.category,property_type:propertyType.name,property_type_slug:propertyType.slug,client_draft_key:value.draftKey,declaration_accepted_at:new Date().toISOString() } };
  const { data, error } = await supabase.from("properties").insert(insertPayload).select("id,reference_no").single();
  if (error){
    logEvent("error","property.draft_create_failed",{requestId,route:"POST /api/properties",action:"property.draft.create",userId:auth.user.id,code:error.code,message:error.message,details:error.details,hint:error.hint,payloadKeys:Object.keys(insertPayload).sort()});
    const failure={error:"PROPERTY_DRAFT_CREATE_FAILED",message:"The property draft could not be created. Retry or contact support with the request ID.",requestId};
    if(wantsJson)return NextResponse.json(failure,{status:500,headers:{"x-request-id":requestId}});
    return NextResponse.redirect(new URL(`/post-property?error=${failure.error}&requestId=${encodeURIComponent(requestId)}`,request.url),303);
  }
  const {error:auditError}=await supabase.rpc("record_audit_event",{event_action:"property.create",event_type:"property",event_reference:data.reference_no,event_new:{status:"draft"}});
  if(auditError)logEvent("warn","property.draft_audit_failed",{requestId,route:"POST /api/properties",userId:auth.user.id,propertyId:data.id,code:auditError.code,message:auditError.message});
  const editUrl=`/dashboard/properties/${data.id}?notice=created`;
  if(wantsJson)return NextResponse.json({id:data.id,referenceNo:data.reference_no,editUrl},{status:201,headers:{"x-request-id":requestId}});
  return NextResponse.redirect(new URL(editUrl, request.url), 303);
}
