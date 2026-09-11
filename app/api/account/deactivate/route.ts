import {NextRequest,NextResponse} from "next/server";
import {clearSessionControlCookies} from "@/src/lib/auth/session-control";
import {verifyCaptcha} from "@/src/lib/security/captcha";
import {requestData,requestIp} from "@/src/lib/request";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export async function POST(request:NextRequest){
  const wantsJson=request.headers.get("accept")?.includes("application/json")===true;
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const data=await requestData(request),token=typeof data["cf-turnstile-response"]==="string"?data["cf-turnstile-response"]:null;if(!await verifyCaptcha(token,requestIp(request)))return NextResponse.json({error:"CAPTCHA verification failed."},{status:400});
  const email=typeof data.email==="string"?data.email.trim():"",confirmation=typeof data.confirmation==="string"?data.confirmation.trim():"";if(confirmation!=="DELETE MY ACCOUNT")return NextResponse.json({error:"Enter DELETE MY ACCOUNT exactly to confirm."},{status:400});
  const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});if(email.toLowerCase()!==auth.user.email?.toLowerCase())return NextResponse.json({error:"Enter the verified email address for this account."},{status:400});
  const{error}=await supabase.rpc("deactivate_current_account",{confirmed_email:email});if(error)return NextResponse.json({error:error.message.includes("administrator_support_required")?"Administrator accounts require support-assisted deactivation.":"The account could not be deactivated."},{status:409});
  await supabase.auth.signOut();const redirectTo="/login?notice=account_deactivated",response=wantsJson?NextResponse.json({redirectTo}):NextResponse.redirect(new URL(redirectTo,request.url),303);clearSessionControlCookies(response);return response;
}
