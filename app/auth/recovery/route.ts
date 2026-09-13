import {createServerClient} from "@supabase/ssr";
import {NextRequest,NextResponse} from "next/server";
import {requireSupabaseEnv} from "@/src/lib/env";
import {logEvent} from "@/src/lib/observability/logger";

export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get("code");
  if(!code)return NextResponse.redirect(new URL("/reset-password?error=invalid_link",request.url),303);
  const{url,anonKey}=requireSupabaseEnv();
  const response=NextResponse.redirect(new URL("/reset-password",request.url),303);
  const supabase=createServerClient(url,anonKey,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:(items)=>items.forEach(({name,value,options})=>response.cookies.set(name,value,options)),
  }});
  try{
    const{data,error}=await supabase.auth.exchangeCodeForSession(code);
    const redirectType=(data as typeof data&{redirectType?:string}).redirectType;
    if(error||!data.session||redirectType!=="PASSWORD_RECOVERY"){logEvent("warn","auth.recovery_exchange_failed",{code:error?.code||"recovery_session_missing"});return NextResponse.redirect(new URL("/reset-password?error=invalid_link",request.url),303)}
    return response;
  }catch{
    logEvent("warn","auth.recovery_exchange_failed",{code:"exchange_exception"});
    return NextResponse.redirect(new URL("/reset-password?error=invalid_link",request.url),303);
  }
}
