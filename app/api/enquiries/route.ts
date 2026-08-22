import { NextRequest, NextResponse } from "next/server";
import { env } from "@/src/lib/env";
import { enquirySchema } from "@/src/lib/enquiries/validation";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { verifyCaptcha } from "@/src/lib/security/captcha";
import { requestData, requestIp } from "@/src/lib/request";
import {sendTemplateEmail} from "@/src/lib/email/service";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
import {logEvent} from "@/src/lib/observability/logger";

export async function POST(request: NextRequest) {
  const requestId=request.headers.get("x-request-id")||crypto.randomUUID();
  const ip = requestIp(request); const rate = await checkRateLimit(`enquiry:${ip}`, 5, 10 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many enquiries from this connection. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  if (!env.isSupabaseConfigured) return NextResponse.json({ error: "Enquiry storage is not configured yet. Please call or WhatsApp OngoleProperty.com." }, { status: 503 });
  const parsed = enquirySchema.safeParse(await requestData(request)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message||"Please check your enquiry details." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ success: true }, { status: 201 });
  const captchaOk = await verifyCaptcha(parsed.data.captchaToken || parsed.data["cf-turnstile-response"] || null, ip); if (!captchaOk) return NextResponse.json({ error: "CAPTCHA verification failed." }, { status: 400 });
  const supabase=createSupabaseServiceClient();if(!supabase){logEvent("error","enquiry.storage_unavailable",{requestId,route:"POST /api/enquiries"});return NextResponse.json({error:"Enquiry service is temporarily unavailable. Please call or WhatsApp our team.",requestId},{status:503,headers:{"x-request-id":requestId}})}
  let propertyId: string | null = null;
  if (parsed.data.propertyReference) { const { data } = await supabase.from("properties").select("id").eq("reference_no", parsed.data.propertyReference).eq("status", "published").maybeSingle(); propertyId = data?.id || null; }
  const { data, error } = await supabase.from("enquiries").insert({ property_id: propertyId, name: parsed.data.name, mobile: parsed.data.mobile, email: parsed.data.email || null, message: parsed.data.message, source: "website", attribution: { property_reference: parsed.data.propertyReference || null,enquiry_type:parsed.data.enquiryType||null,property_requirement:parsed.data.propertyRequirement||null,is_foreign_mobile:parsed.data.isForeign==="true" }, privacy_safe_ip_hash: null, user_agent: request.headers.get("user-agent")?.slice(0, 500) || null }).select("reference_no").single();
  if (error){logEvent("error","enquiry.create_failed",{requestId,route:"POST /api/enquiries",code:error.code,message:error.message,details:error.details,hint:error.hint});return NextResponse.json({ error: "We could not save your enquiry. Please try again, call or WhatsApp our team.",requestId }, { status: 500,headers:{"x-request-id":requestId} });}
  await sendTemplateEmail(env.smtp.admin,"new-enquiry",{name:parsed.data.name,reference:data.reference_no,message:parsed.data.message});
  return NextResponse.json({ success: true, reference: data.reference_no }, { status: 201,headers:{"x-request-id":requestId} });
}
