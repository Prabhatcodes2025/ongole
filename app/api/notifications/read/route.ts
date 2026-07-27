import {NextRequest,NextResponse} from "next/server";
import {requestData} from "@/src/lib/request";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const data=await requestData(request);if(data.action==="all")await supabase.rpc("mark_all_notifications_read");else if(typeof data.id==="string")await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",data.id).eq("user_id",auth.user.id);
  const returnTo=typeof data.returnTo==="string"&&data.returnTo.startsWith("/")&&!data.returnTo.startsWith("//")?data.returnTo:request.headers.get("referer")||"/dashboard";
  return NextResponse.redirect(new URL(returnTo,request.url),303);
}
