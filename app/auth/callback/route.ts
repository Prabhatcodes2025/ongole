import {NextRequest,NextResponse} from "next/server";
import type {EmailOtpType} from "@supabase/supabase-js";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {reconcileAuthenticatedProfile,safeReturnPath} from "@/src/lib/auth/session";
import {logEvent} from "@/src/lib/observability/logger";

export async function GET(request:NextRequest){
  const next=safeReturnPath(request.nextUrl.searchParams.get("next"));const code=request.nextUrl.searchParams.get("code");const tokenHash=request.nextUrl.searchParams.get("token_hash");const type=request.nextUrl.searchParams.get("type") as EmailOtpType|null;const supabase=await createSupabaseServerClient();
  const result=code?await supabase.auth.exchangeCodeForSession(code):tokenHash&&type?await supabase.auth.verifyOtp({token_hash:tokenHash,type}):{data:{user:null},error:new Error("missing_auth_code")};
  if(result.error){logEvent("warn","auth.callback_failed",{reason:code?"code_exchange":"otp_verification"});return NextResponse.redirect(new URL("/login?error=confirmation_failed",request.url),303)}
  const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.redirect(new URL("/login?error=session_missing",request.url),303);
  const profile=await reconcileAuthenticatedProfile(supabase,auth.user);if(!profile.ok){await supabase.auth.signOut();logEvent("warn","auth.callback_profile_failed",{code:profile.errorCode});return NextResponse.redirect(new URL("/login?error=profile_unavailable",request.url),303)}
  return NextResponse.redirect(new URL(`${next}${profile.repaired?(next.includes("?")?"&":"?")+"notice=profile_repaired":""}`,request.url),303);
}
