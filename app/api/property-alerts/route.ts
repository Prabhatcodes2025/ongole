import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {getPublicPropertyCatalog} from "@/src/lib/masters/public";
import {requestData,requestIp} from "@/src/lib/request";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {optionalNumber,requirementSchema,requirementUsesCatalog} from "@/src/lib/property-alerts/validation";
import {logEvent} from "@/src/lib/observability/logger";

const uuid=z.string().uuid();
function result(request:NextRequest,message:string,status:number){
  if((request.headers.get("content-type")||"").includes("application/json"))return NextResponse.json({error:message},{status});
  const url=new URL("/dashboard/property-alerts",request.url);url.searchParams.set("error",message);return NextResponse.redirect(url,303);
}
export async function POST(request:NextRequest){
  if(request.headers.get("origin")!==request.nextUrl.origin)return result(request,"Invalid request origin.",403);
  const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return result(request,"Please sign in to manage alerts.",401);
  const rate=await checkRateLimit(`property-alert:${user.id}:${requestIp(request)}`,30,60*60_000);if(!rate.allowed)return result(request,"Too many changes. Please try again later.",429);
  let data:Record<string,unknown>;try{data=await requestData(request)}catch{return result(request,"Invalid alert request.",400)}
  const action=String(data.action||"");const id=uuid.safeParse(data.id);
  if(action==="pause"||action==="resume"||action==="delete"){
    if(!id.success)return result(request,"Invalid alert.",400);
    const query=supabase.from("property_alert_requirements");
    const response=action==="delete"?await query.delete().eq("id",id.data).eq("user_id",user.id):await query.update({active:action==="resume",updated_at:new Date().toISOString()}).eq("id",id.data).eq("user_id",user.id);
    if(response.error){logEvent("error","property_alert.mutation_failed",{code:response.error.code,action});return result(request,"Unable to update this alert.",500)}
  }else if(action==="create"||action==="update"){
    if(action==="update"&&!id.success)return result(request,"Invalid alert.",400);
    const locations=Array.isArray(data.locations)?data.locations:data.locations?String(data.locations).split(","):[];
    const parsed=requirementSchema.safeParse({transaction_type:data.transaction_type,category_slug:data.category_slug||null,property_type_slug:data.property_type_slug||null,locations:locations.map(String).map(item=>item.trim()).filter(Boolean),min_budget:optionalNumber(data.min_budget),max_budget:optionalNumber(data.max_budget),min_area_sq_ft:optionalNumber(data.min_area_sq_ft),max_area_sq_ft:optionalNumber(data.max_area_sq_ft),bedrooms:optionalNumber(data.bedrooms)});
    if(!parsed.success)return result(request,"Please check the alert fields and ranges.",400);
    const catalog=await getPublicPropertyCatalog();if(!requirementUsesCatalog(parsed.data,catalog))return result(request,"Choose a valid category, type and location.",400);
    if(action==="create"){
      const {count}=await supabase.from("property_alert_requirements").select("id",{count:"exact",head:true}).eq("user_id",user.id);
      if((count||0)>=20)return result(request,"You can save up to 20 property alerts.",400);
    }
    const response=action==="create"?await supabase.from("property_alert_requirements").insert({...parsed.data,user_id:user.id}):await supabase.from("property_alert_requirements").update({...parsed.data,updated_at:new Date().toISOString()}).eq("id",id.data).eq("user_id",user.id);
    if(response.error){logEvent("error","property_alert.save_failed",{code:response.error.code});return result(request,"Unable to save this alert.",500)}
  }else return result(request,"Invalid alert action.",400);
  return NextResponse.redirect(new URL("/dashboard/property-alerts",request.url),303);
}
