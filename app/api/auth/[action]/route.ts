import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { requestData, requestIp } from "@/src/lib/request";
import { env } from "@/src/lib/env";
import { verifyCaptcha } from "@/src/lib/security/captcha";
import { sendTemplateEmail } from "@/src/lib/email/service";
import {loginErrorCode,normalizeEmail,reconcileAuthenticatedProfile,safeReturnPath} from "@/src/lib/auth/session";
import {logEvent} from "@/src/lib/observability/logger";

const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(200),returnTo:z.string().optional() });
const registerSchema = loginSchema.extend({ name: z.string().trim().min(2).max(100), mobile: z.string().regex(/^[6-9][0-9]{9}$/), accountType: z.enum(["buyer","owner","agent","pg_owner"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const ip = requestIp(request);
  const rate = await checkRateLimit(`auth:${action}:${ip}`, action === "login" ? 6 : 3, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  if (!env.isSupabaseConfigured) return NextResponse.json({ error: "Authentication is not configured yet. Add the Supabase environment values." }, { status: 503 });
  const data = await requestData(request);
  if(!["logout"].includes(action)){const token=typeof data["cf-turnstile-response"]==="string"?data["cf-turnstile-response"]:null;if(!await verifyCaptcha(token,ip))return NextResponse.json({error:"CAPTCHA verification failed."},{status:400})}
  const supabase = await createSupabaseServerClient();
  if (action === "login") {
    const parsed = loginSchema.safeParse(data); if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    const email=normalizeEmail(parsed.data.email),returnTo=safeReturnPath(parsed.data.returnTo);
    const {data:login,error}=await supabase.auth.signInWithPassword({email,password:parsed.data.password});
    if(error||!login.user){const code=loginErrorCode(error||{});logEvent("warn","auth.login_failed",{code});return NextResponse.redirect(new URL(`/login?error=${code}&returnTo=${encodeURIComponent(returnTo)}`,request.url),303)}
    const profile=await reconcileAuthenticatedProfile(supabase,login.user);
    if(!profile.ok){await supabase.auth.signOut();logEvent("warn","auth.profile_reconciliation_failed",{code:profile.errorCode,status:profile.status});return NextResponse.redirect(new URL(`/login?error=${profile.errorCode||"profile_unavailable"}`,request.url),303)}
    await supabase.rpc("record_audit_event",{event_action:"auth.login",event_type:"session",event_reference:login.user.id,event_new:{method:"password",profile_repaired:profile.repaired}});
    return NextResponse.redirect(new URL(`${returnTo}${profile.repaired?(returnTo.includes("?")?"&":"?")+"notice=profile_repaired":""}`, request.url), 303);
  }
  if (action === "register") {
    const parsed = registerSchema.safeParse(data); if (!parsed.success) return NextResponse.json({ error: "Check your registration details and try again." }, { status: 400 });
    const { password, name, mobile, accountType } = parsed.data;const email=normalizeEmail(parsed.data.email);
    const { data: result, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(safeReturnPath(parsed.data.returnTo))}`, data: { full_name: name, mobile, account_type: accountType } } });
    if (error){logEvent("warn","auth.registration_failed",{code:error.code||"signup_failed"});return NextResponse.redirect(new URL("/register?error=registration_failed",request.url),303)}
    await sendTemplateEmail(email,"welcome",{name});
    if(result.session&&result.user){const profile=await reconcileAuthenticatedProfile(supabase,result.user);if(!profile.ok){await supabase.auth.signOut();return NextResponse.redirect(new URL("/login?error=profile_unavailable",request.url),303)}await supabase.rpc("record_audit_event",{event_action:"auth.register",event_type:"user",event_reference:result.user.id,event_new:{account_type:accountType}})}
    return NextResponse.redirect(new URL(result.session ? "/dashboard" : "/login?notice=check_email", request.url), 303);
  }
  if(action==="forgot-password"){const email=typeof data.email==="string"?normalizeEmail(data.email):"";if(!z.email().safeParse(email).success)return NextResponse.json({error:"Enter a valid email."},{status:400});const{error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${env.siteUrl}/auth/callback?next=/update-password`});if(error)logEvent("warn","auth.password_reset_request_failed",{code:error.code||"reset_failed"});await sendTemplateEmail(email,"password-reset",{name:"Customer"});return NextResponse.redirect(new URL("/login?notice=reset_sent",request.url),303)}
  if(action==="update-password"){const password=typeof data.password==="string"?data.password:"";if(password.length<8||password.length>200)return NextResponse.redirect(new URL("/update-password?error=invalid_password",request.url),303);const{error}=await supabase.auth.updateUser({password});if(error){logEvent("warn","auth.password_update_failed",{code:error.code||"update_failed"});return NextResponse.redirect(new URL("/update-password?error=update_failed",request.url),303)}return NextResponse.redirect(new URL("/dashboard?notice=password_updated",request.url),303)}
  if (action === "logout") { const {data:current}=await supabase.auth.getUser();await supabase.rpc("record_audit_event",{event_action:"auth.logout",event_type:"session",event_reference:current.user?.email||current.user?.id||"authenticated-user"});await supabase.auth.signOut(); return NextResponse.redirect(new URL("/", request.url), 303); }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
