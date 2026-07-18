import {createServerClient} from "@supabase/ssr";
import {NextRequest,NextResponse} from "next/server";

export async function proxy(request:NextRequest){
  const requestId=request.headers.get("x-request-id")||crypto.randomUUID();const requestHeaders=new Headers(request.headers);requestHeaders.set("x-request-id",requestId);let response=NextResponse.next({request:{headers:requestHeaders}});const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(url&&key){
    const supabase=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(items)=>{items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request:{headers:requestHeaders}});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
    // getUser validates the access token and refreshes expired auth cookies. Do not
    // insert application logic between client creation and this call.
    await supabase.auth.getUser();
  }
  response.headers.set("x-request-id",requestId);return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|images/).*)"]};
