import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {requestIp} from "@/src/lib/request";
import {logEvent} from "@/src/lib/observability/logger";

const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("enable"),deviceId:z.string().uuid(),token:z.string().min(30).max(4096)}),
  z.object({action:z.literal("disable"),deviceId:z.string().uuid(),permissionStatus:z.literal("revoked")}),
  z.object({action:z.literal("status"),permissionStatus:z.enum(["denied","unsupported"])}),
]);
export async function POST(request:NextRequest){
  if(request.headers.get("origin")!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
  const rate=await checkRateLimit(`push-register:${user.id}:${requestIp(request)}`,15,60*60_000);if(!rate.allowed)return NextResponse.json({error:"Too many attempts. Please try again later."},{status:429});
  let input:unknown;try{input=await request.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}const parsed=schema.safeParse(input);if(!parsed.success)return NextResponse.json({error:"Invalid request."},{status:400});
  const service=createSupabaseServiceClient();if(!service)return NextResponse.json({error:"Property alerts are not configured yet."},{status:503});
  const value=parsed.data;let error;
  if(value.action==="enable"){
    // A token belongs to exactly one account; reassigning a known token is forbidden.
    const existing=await service.from("push_registrations").select("id,user_id,active").eq("fcm_token",value.token).maybeSingle();
    if(existing.data&&existing.data.user_id!==user.id&&existing.data.active)return NextResponse.json({error:"This browser is already registered to another account. Sign out there first."},{status:409});
    const timestamp=new Date().toISOString();
    if(existing.data?.user_id===user.id){
      await service.from("push_registrations").delete().eq("user_id",user.id).eq("device_id",value.deviceId).neq("id",existing.data.id);
      ({error}=await service.from("push_registrations").update({device_id:value.deviceId,active:true,updated_at:timestamp,last_seen_at:timestamp}).eq("id",existing.data.id).eq("user_id",user.id));
    }else{
      if(existing.data&&!existing.data.active)await service.from("push_registrations").delete().eq("id",existing.data.id);
      ({error}=await service.from("push_registrations").upsert({user_id:user.id,device_id:value.deviceId,fcm_token:value.token,active:true,updated_at:timestamp,last_seen_at:timestamp},{onConflict:"user_id,device_id"}));
    }
    if(!error)({error}=await service.from("property_alert_preferences").upsert({user_id:user.id,enabled:true,permission_status:"granted",updated_at:new Date().toISOString()},{onConflict:"user_id"}));
  }else if(value.action==="disable"){
    ({error}=await service.from("push_registrations").update({active:false,updated_at:new Date().toISOString()}).eq("user_id",user.id).eq("device_id",value.deviceId));
    if(!error)({error}=await service.from("property_alert_preferences").upsert({user_id:user.id,enabled:false,permission_status:value.permissionStatus,updated_at:new Date().toISOString()},{onConflict:"user_id"}));
  }else ({error}=await service.from("property_alert_preferences").upsert({user_id:user.id,enabled:false,permission_status:value.permissionStatus,updated_at:new Date().toISOString()},{onConflict:"user_id"}));
  if(error){logEvent("error","push.registration_failed",{code:error.code});return NextResponse.json({error:"Could not update notification settings."},{status:500})}
  const response=NextResponse.json({ok:true});if(value.action==="enable")response.cookies.set("op_push_device",value.deviceId,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:365*24*60*60});else if(value.action==="disable")response.cookies.delete("op_push_device");return response;
}
