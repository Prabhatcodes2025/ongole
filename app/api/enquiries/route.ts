import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env, requireSupabaseEnv } from "@/src/lib/env";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { verifyCaptcha } from "@/src/lib/security/captcha";
import { requestData, requestIp } from "@/src/lib/request";

const schema = z.object({ propertyReference: z.string().trim().max(40).optional().default(""), name: z.string().trim().min(2).max(100), mobile: z.string().transform((value) => value.replace(/\D/g, "").slice(-10)).pipe(z.string().regex(/^[6-9][0-9]{9}$/)), email: z.union([z.literal(""),z.email()]).optional().default(""), message: z.string().trim().min(5).max(2000), captchaToken: z.string().optional(), "cf-turnstile-response": z.string().optional() });

export async function POST(request: NextRequest) {
  const ip = requestIp(request); const rate = checkRateLimit(`enquiry:${ip}`, 5, 10 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many enquiries from this connection. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  if (!env.isSupabaseConfigured) return NextResponse.json({ error: "Enquiry storage is not configured yet. Please call or WhatsApp OngoleProperty.com." }, { status: 503 });
  const parsed = schema.safeParse(await requestData(request)); if (!parsed.success) return NextResponse.json({ error: "Please check your name, mobile number and message." }, { status: 400 });
  const captchaOk = await verifyCaptcha(parsed.data.captchaToken || parsed.data["cf-turnstile-response"] || null, ip); if (!captchaOk) return NextResponse.json({ error: "CAPTCHA verification failed." }, { status: 400 });
  const { url, anonKey } = requireSupabaseEnv(); const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  let propertyId: string | null = null;
  if (parsed.data.propertyReference) { const { data } = await supabase.from("properties").select("id").eq("reference_no", parsed.data.propertyReference).eq("status", "published").maybeSingle(); propertyId = data?.id || null; }
  const { data, error } = await supabase.from("enquiries").insert({ property_id: propertyId, name: parsed.data.name, mobile: parsed.data.mobile, email: parsed.data.email || null, message: parsed.data.message, source: "website", attribution: { property_reference: parsed.data.propertyReference || null }, privacy_safe_ip_hash: null, user_agent: request.headers.get("user-agent")?.slice(0, 500) || null }).select("reference_no").single();
  if (error) return NextResponse.json({ error: "We could not save your enquiry. Please call or WhatsApp our team." }, { status: 500 });
  return NextResponse.json({ success: true, reference: data.reference_no }, { status: 201 });
}
