import {NextRequest,NextResponse,after} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {requestData,requestIp} from "@/src/lib/request";
import {enqueueManualPush,processPushQueue} from "@/src/lib/property-alerts/dispatch";
import {logEvent} from "@/src/lib/observability/logger";

const schema=z.object({kind:z.enum(["property","general"]),propertyId:z.string().uuid().optional(),scope:z.enum(["matching","all"]).optional(),title:z.string().trim().min(5).max(120),body:z.string().trim().min(10).max(240),confirmation:z.literal("SEND PUSH")}).refine(value=>value.kind!=="property"||Boolean(value.propertyId));
function error(request:NextRequest,message:string,status:number){if((request.headers.get("content-type")||"").includes("application/json"))return NextResponse.json({error:message},{status});const url=new URL("/admin/push-notifications",request.url);url.searchParams.set("error",message);return NextResponse.redirect(url,303)}
export async function POST(request:NextRequest){
  if(request.headers.get("origin")!==request.nextUrl.origin)return NextResponse.json({error:"Invalid origin."},{status:403});
  const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});const {data:allowed}=await supabase.rpc("has_permission",{required_permission:"notifications.manage"});if(!allowed)return NextResponse.json({error:"Permission denied."},{status:403});
  const rate=await checkRateLimit(`admin-push:${user.id}:${requestIp(request)}`,3,60*60_000);if(!rate.allowed)return error(request,"Manual send limit reached. Try again later.",429);
  let data:Record<string,unknown>;try{data=await requestData(request)}catch{return error(request,"Invalid request.",400)}const parsed=schema.safeParse(data);if(!parsed.success)return error(request,"Check the message, audience and confirmation.",400);
  const service=createSupabaseServiceClient();if(!service)return error(request,"Push service unavailable.",503);
  try{
    const input=parsed.data;const requestId=crypto.randomUUID();const count=await enqueueManualPush(service,{kind:input.kind==="property"?"manual_property":"general",propertyId:input.propertyId,scope:input.kind==="property"?input.scope||"matching":undefined,title:input.title,body:input.body,requestId});
    await supabase.rpc("record_audit_event",{event_action:"push.manual_queue",event_type:"notification",event_reference:requestId,event_new:{kind:input.kind,scope:input.scope||null,property_id:input.propertyId||null,registrations:count}});
    logEvent("info","push.manual_queued",{requestId,adminId:user.id,registrations:count});after(async()=>{const active=createSupabaseServiceClient();if(active)await processPushQueue(active)});
    const url=new URL("/admin/push-notifications",request.url);url.searchParams.set("notice","queued");return NextResponse.redirect(url,303);
  }catch(failure){logEvent("error","push.manual_failed",{code:failure instanceof Error?failure.message:"unknown"});return error(request,"Could not queue this notification. Check the published property and audience limit.",400)}
}
