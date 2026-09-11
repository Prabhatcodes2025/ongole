import {NextRequest,NextResponse} from "next/server";
import type {EmailOtpType} from "@supabase/supabase-js";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {reconcileAuthenticatedProfile,safeReturnPath} from "@/src/lib/auth/session";
import {logEvent} from "@/src/lib/observability/logger";
import {setSessionControlCookies} from "@/src/lib/auth/session-control";

export async function GET(request:NextRequest){
  const next=safeReturnPath(request.nextUrl.searchParams.get("next")),keepSignedIn=request.nextUrl.searchParams.get("keep")==="1";const code=request.nextUrl.searchParams.get("code");const tokenHash=request.nextUrl.searchParams.get("token_hash");const type=request.nextUrl.searchParams.get("type") as EmailOtpType|null;const intent=request.nextUrl.searchParams.get("intent");const termsVersion=request.nextUrl.searchParams.get("termsVersion");const supabase=await createSupabaseServerClient();
  const result=code?await supabase.auth.exchangeCodeForSession(code):tokenHash&&type?await supabase.auth.verifyOtp({token_hash:tokenHash,type}):{data:{user:null},error:new Error("missing_auth_code")};
  if(result.error){logEvent("warn","auth.callback_failed",{reason:code?"code_exchange":"otp_verification"});return NextResponse.redirect(new URL("/login?error=confirmation_failed",request.url),303)}
  const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.redirect(new URL("/login?error=session_missing",request.url),303);
  if(["buyer","owner","agent","pg_owner"].includes(intent||"")&&termsVersion==="2026-08-13"){
    const{error:accountError}=await supabase.rpc("claim_new_google_account",{requested_account_type:intent,accepted_terms_version:termsVersion});
    if(accountError){await supabase.auth.signOut();logEvent("warn","auth.google_account_claim_failed",{code:accountError.code});return NextResponse.redirect(new URL("/login?error=profile_unavailable",request.url),303)}
  }
  await supabase.rpc("reactivate_current_account");const profile=await reconcileAuthenticatedProfile(supabase,auth.user);if(!profile.ok){await supabase.auth.signOut();logEvent("warn","auth.callback_profile_failed",{code:profile.errorCode});return NextResponse.redirect(new URL("/login?error=profile_unavailable",request.url),303)}
  const{data:requiredProfile}=await supabase.from("profiles").select("mobile").eq("id",auth.user.id).maybeSingle();if(!requiredProfile?.mobile){const response=NextResponse.redirect(new URL(`/dashboard/profile?complete=1&returnTo=${encodeURIComponent(next)}`,request.url),303);setSessionControlCookies(response,keepSignedIn);return response}const response=NextResponse.redirect(new URL(`${next}${profile.repaired?(next.includes("?")?"&":"?")+"notice=profile_repaired":""}`,request.url),303);setSessionControlCookies(response,keepSignedIn);return response;
}
