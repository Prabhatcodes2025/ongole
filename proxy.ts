import {createServerClient} from "@supabase/ssr";
import {NextRequest,NextResponse} from "next/server";
import {clearSessionControlCookies,SESSION_ACTIVITY_COOKIE,SESSION_KEEP_COOKIE,SESSION_START_COOKIE,sessionTiming} from "@/src/lib/auth/session-control";

export async function proxy(request:NextRequest){
  const requestId=request.headers.get("x-request-id")||crypto.randomUUID();const requestHeaders=new Headers(request.headers);requestHeaders.set("x-request-id",requestId);let response=NextResponse.next({request:{headers:requestHeaders}});const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(url&&key){
    const supabase=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(items)=>{items.forEach(({name,value})=>request.cookies.set(name,value));items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
    // getUser validates the access token and refreshes expired auth cookies. Do not
    // insert application logic between client creation and this call.
    const{data:auth}=await supabase.auth.getUser();
    if(auth.user){
      const timing=sessionTiming(request.cookies.get(SESSION_START_COOKIE)?.value,request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value);
      const{data:profile}=await supabase.from("profiles").select("status").eq("id",auth.user.id).maybeSingle();
      if(timing.expired||profile?.status!=="active"){
        response=request.nextUrl.pathname.startsWith("/api/")?NextResponse.json({error:timing.expired?"Session expired.":"Account is inactive."},{status:401}):NextResponse.redirect(new URL(timing.expired?"/login?notice=session_expired":"/login?error=account_inactive",request.url),303);await supabase.auth.signOut();clearSessionControlCookies(response);
      }else{
        const keep=request.cookies.get(SESSION_KEEP_COOKIE)?.value==="1";response.cookies.set(SESSION_ACTIVITY_COOKIE,String(Date.now()),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",...(keep?{maxAge:24*60*60}:{})});
      }
    }
  }
  response.headers.set("x-request-id",requestId);return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|images/).*)"]};
