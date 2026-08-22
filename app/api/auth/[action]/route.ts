import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { requestData, requestIp } from "@/src/lib/request";
import { env } from "@/src/lib/env";
import { verifyCaptcha } from "@/src/lib/security/captcha";
import { sendTemplateEmail } from "@/src/lib/email/service";
import {isValidIndianMobile,normalizeMobile} from "@/src/lib/auth/mobile";
import {loginErrorCode,normalizeEmail,reconcileAuthenticatedProfile,safeReturnPath} from "@/src/lib/auth/session";
import {logEvent} from "@/src/lib/observability/logger";
import {registrationFieldMessages,registrationFieldsFromIssues} from "@/src/lib/auth/registration";

const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(200),returnTo:z.string().optional() });
const strongPassword=z.string().min(8).max(200).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/);
const termsVersion="2026-08-13";
const registerSchema = loginSchema.extend({ name: z.string().trim().min(2).max(100),password:strongPassword, mobile: z.string().transform(normalizeMobile).refine(isValidIndianMobile), accountType: z.enum(["buyer","owner","agent","pg_owner"]),termsAccepted:z.literal("accepted"),yearsExperience:z.union([z.coerce.number().int().min(0).max(80),z.literal("").transform(()=>undefined)]).optional(),officeAddress:z.string().trim().max(500).optional().default(""),about:z.string().trim().max(1500).optional().default(""),workingTowns:z.string().trim().max(300).optional().default(""),specializations:z.string().trim().max(500).optional().default("") });
const list=(value:string,limit:number)=>[...new Set(value.split(",").map((item)=>item.trim()).filter(Boolean))].slice(0,limit);

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const ip = requestIp(request);
  const rate = await checkRateLimit(`auth:${action}:${ip}`, action === "login" ? 6 : 3, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  if (!env.isSupabaseConfigured) return NextResponse.json({ error: "Authentication is not configured yet. Add the Supabase environment values." }, { status: 503 });
  const data = await requestData(request);
  if(!["logout","google"].includes(action)){const token=typeof data["cf-turnstile-response"]==="string"?data["cf-turnstile-response"]:null;if(!await verifyCaptcha(token,ip))return NextResponse.json({error:"CAPTCHA verification failed."},{status:400})}
  const supabase = await createSupabaseServerClient();
  if(action==="google"){
    const returnTo=safeReturnPath(data.returnTo);const accountType=["buyer","owner","agent","pg_owner"].includes(String(data.accountType||""))?String(data.accountType):null;
    if(accountType&&data.termsAccepted!=="accepted")return NextResponse.redirect(new URL(`/register?error=terms_required&returnTo=${encodeURIComponent(returnTo)}`,request.url),303);
    const callback=new URL("/auth/callback",env.siteUrl);callback.searchParams.set("next",returnTo);if(accountType){callback.searchParams.set("intent",accountType);callback.searchParams.set("termsVersion",termsVersion)}
    const{data:oauth,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:callback.toString(),queryParams:{prompt:"select_account"}}});
    if(error||!oauth.url){logEvent("warn","auth.google_start_failed",{code:error?.code||"oauth_url_missing"});return NextResponse.redirect(new URL(accountType?`/register?error=oauth_failed&accountType=${accountType}`:"/login?error=auth_unavailable",request.url),303)}
    return NextResponse.redirect(oauth.url,303);
  }
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
    const parsed = registerSchema.safeParse(data); if (!parsed.success){const fields=registrationFieldsFromIssues(parsed.error.issues.map(issue=>String(issue.path[0]||"form")));logEvent("warn","auth.registration_validation_failed",{fields});if(request.headers.get("accept")?.includes("application/json"))return NextResponse.json({error:"Please correct the invalid registration fields.",fields:Object.fromEntries(fields.map(field=>[field,registrationFieldMessages[field]]))},{status:400});const url=new URL("/register?error=invalid_details",request.url);if(fields.length)url.searchParams.set("fields",fields.join(","));if(typeof data.accountType==="string")url.searchParams.set("accountType",data.accountType);if(typeof data.returnTo==="string")url.searchParams.set("returnTo",safeReturnPath(data.returnTo));return NextResponse.redirect(url,303)}
    const { password, name, mobile, accountType } = parsed.data;const email=normalizeEmail(parsed.data.email);const agentMetadata=accountType==="agent"?{years_experience:parsed.data.yearsExperience??null,office_address:parsed.data.officeAddress||null,about:parsed.data.about||null,working_towns:list(parsed.data.workingTowns,5),specializations:list(parsed.data.specializations,20)}:{};
    const{data:mobileAvailable,error:mobileCheckError}=await supabase.rpc("is_mobile_available",{candidate_mobile:mobile});
    if(mobileCheckError){logEvent("error","auth.mobile_availability_failed",{code:mobileCheckError.code});return NextResponse.redirect(new URL("/register?error=registration_failed",request.url),303)}
    if(!mobileAvailable)return NextResponse.redirect(new URL("/register?error=mobile_unavailable",request.url),303);
    const acceptedAt=new Date().toISOString();
    const { data: result, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(safeReturnPath(parsed.data.returnTo))}`, data: { full_name: name, mobile, account_type: accountType, terms_accepted_at:acceptedAt,terms_version:termsVersion, ...agentMetadata } } });
    if (error){logEvent("warn","auth.registration_failed",{code:error.code||"signup_failed"});return NextResponse.redirect(new URL("/register?error=registration_failed",request.url),303)}
    if(result.user&&Array.isArray(result.user.identities)&&result.user.identities.length===0){logEvent("info","auth.registration_existing_account",{});return NextResponse.redirect(new URL("/register?error=account_exists",request.url),303)}
    await sendTemplateEmail(email,"welcome",{name});
    if(result.session&&result.user){const profile=await reconcileAuthenticatedProfile(supabase,result.user);if(!profile.ok){await supabase.auth.signOut();return NextResponse.redirect(new URL("/login?error=profile_unavailable",request.url),303)}await supabase.rpc("record_audit_event",{event_action:"auth.register",event_type:"user",event_reference:result.user.id,event_new:{account_type:accountType}})}
    return NextResponse.redirect(new URL(result.session ? "/dashboard" : "/login?notice=check_email", request.url), 303);
  }
  if(action==="forgot-password"){const email=typeof data.email==="string"?normalizeEmail(data.email):"";if(!z.email().safeParse(email).success)return NextResponse.json({error:"Enter a valid email."},{status:400});const{error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${env.siteUrl}/auth/callback?next=/update-password`});if(error)logEvent("warn","auth.password_reset_request_failed",{code:error.code||"reset_failed"});await sendTemplateEmail(email,"password-reset",{name:"Customer"});return NextResponse.redirect(new URL("/login?notice=reset_sent",request.url),303)}
  if(action==="update-password"){const password=typeof data.password==="string"?data.password:"";if(password.length<8||password.length>200)return NextResponse.redirect(new URL("/update-password?error=invalid_password",request.url),303);const{error}=await supabase.auth.updateUser({password});if(error){logEvent("warn","auth.password_update_failed",{code:error.code||"update_failed"});return NextResponse.redirect(new URL("/update-password?error=update_failed",request.url),303)}return NextResponse.redirect(new URL("/dashboard?notice=password_updated",request.url),303)}
  if (action === "logout") { const {data:current}=await supabase.auth.getUser();await supabase.rpc("record_audit_event",{event_action:"auth.logout",event_type:"session",event_reference:current.user?.email||current.user?.id||"authenticated-user"});await supabase.auth.signOut(); return NextResponse.redirect(new URL("/", request.url), 303); }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
