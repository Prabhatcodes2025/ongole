import "server-only";
import type {createSupabaseServiceClient} from "@/src/lib/supabase/service";
import {matchesPropertyAlert,propertyAlertPath,type AlertRequirement,type MatchableProperty} from "@/src/lib/property-alerts/matching";
import {firebaseAdminConfigured,isInvalidFirebaseToken,sendPropertyPush} from "@/src/lib/property-alerts/firebase-admin";
import {logEvent} from "@/src/lib/observability/logger";

type Service=NonNullable<ReturnType<typeof createSupabaseServiceClient>>;
type Row=Record<string,unknown>;
const nested=(value:unknown):Row=>Array.isArray(value)?value[0] as Row||{}:value&&typeof value==="object"?value as Row:{};
const limitPerUser=3;
const batchSize=50;
const due=()=>new Date().toISOString();
const tomorrow=()=>new Date(Date.now()+30_000).toISOString();
function formatPrice(price:number){return price>=10_000_000?`₹${(price/10_000_000).toFixed(2)} Cr`:price>=100_000?`₹${(price/100_000).toFixed(1)} Lakhs`:`₹${price.toLocaleString("en-IN")}`}
export function pushContent(row:Row){const details=nested(row.details),category=nested(row.property_categories),type=nested(row.property_types);const pg=details.listing_kind==="paying_guest";const path=propertyAlertPath(String(row.slug||""),pg);const property:MatchableProperty={id:String(row.id),transaction_type:String(row.transaction_type),category_slug:String(category.slug||details.category||""),property_type_slug:String(type.slug||details.property_type_slug||""),locality:String(row.locality_text||""),city:String(row.city_text||""),district:String(row.district_text||""),price:Number(row.price_inr||0),area_sq_ft:row.area_sq_ft===null?null:Number(row.area_sq_ft),bedrooms:details.bedrooms===undefined?null:Number(details.bedrooms),status:String(row.status)};const title="New Property Matching Your Requirement";const body=`${property.bedrooms===null?"":`${property.bedrooms}BHK `}${String(type.name||category.name||"Property")} in ${property.locality||property.city} – ${formatPrice(property.price)}`.slice(0,220);return {property,path,title,body};}

export async function enqueueManualPush(service:Service,input:{kind:"property_match"|"manual_property"|"general";propertyId?:string;scope?:"matching"|"all";title:string;body:string;requestId:string}){
  const {data:registrations,error}=await service.from("push_registrations").select("id,user_id").eq("active",true).limit(501);
  if(error)throw new Error("push_subscribers_unavailable");if((registrations||[]).length>500)throw new Error("too_many_subscribers");
  const userIds=[...new Set((registrations||[]).map(item=>item.user_id))];if(!userIds.length)return 0;
  const {data:prefs}=await service.from("property_alert_preferences").select("user_id").in("user_id",userIds).eq("enabled",true).eq("permission_status","granted");const enabled=new Set((prefs||[]).map(item=>item.user_id));
  let content:{property:MatchableProperty;path:string|null;title:string;body:string}|null=null;let matchingUsers:Set<string>|null=null;
  if(input.propertyId){const {data:row}=await service.from("properties").select("id,slug,status,deleted_at,transaction_type,price_inr,area_sq_ft,locality_text,city_text,district_text,details,property_categories(name,slug),property_types(name,slug)").eq("id",input.propertyId).eq("status","published").is("deleted_at",null).maybeSingle();if(!row)throw new Error("property_not_published");content=pushContent(row as Row);if(!content.path)throw new Error("property_path_unavailable");if(input.scope==="matching"){
      const {data:reqs,error:requirementsError}=await service.from("property_alert_requirements").select("*").in("user_id",userIds).eq("active",true).limit(1001);if(requirementsError||(reqs||[]).length>1000)throw new Error("too_many_requirements");matchingUsers=new Set((reqs||[]).filter(req=>matchesPropertyAlert(content!.property,req as AlertRequirement)).map(req=>req.user_id));
    }}
  const day=new Date().toISOString().slice(0,10);const rows=(registrations||[]).filter(reg=>enabled.has(reg.user_id)&&(!matchingUsers||matchingUsers.has(reg.user_id))).map(reg=>({user_id:reg.user_id,registration_id:reg.id,property_id:input.propertyId||null,notification_type:input.kind,title:input.title,body:input.body,action_path:content?.path||"/properties",dedupe_key:input.propertyId?`manual-property:${input.propertyId}:${reg.id}:${day}`:`manual:${input.requestId}:${reg.id}`}));
  if(rows.length){const {error:insertError}=await service.from("push_notification_logs").upsert(rows,{onConflict:"dedupe_key",ignoreDuplicates:true});if(insertError)throw new Error("push_log_insert_failed")}
  return rows.length;
}

async function processPublishJob(service:Service,job:Row){
  const id=String(job.id),propertyId=String(job.property_id);
  const claim=await service.from("push_publish_jobs").update({status:"processing",processing_started_at:due(),attempts:Number(job.attempts||0)+1}).eq("id",id).eq("status","queued").select("id").maybeSingle();if(!claim.data)return 0;
  try{
    const {data:row,error:propertyError}=await service.from("properties").select("id,slug,status,deleted_at,transaction_type,price_inr,area_sq_ft,locality_text,city_text,district_text,details,property_categories(name,slug),property_types(name,slug)").eq("id",propertyId).maybeSingle();if(propertyError)throw new Error("property_lookup_failed");
    if(!row||row.status!=="published"||row.deleted_at){await service.from("push_publish_jobs").update({status:"complete",completed_at:due()}).eq("id",id);return 0}
    const content=pushContent(row as Row);if(!content.path){await service.from("push_publish_jobs").update({status:"complete",completed_at:due()}).eq("id",id);return 0}
    let query=service.from("property_alert_requirements").select("*").eq("active",true).order("id").limit(batchSize);if(job.cursor_id)query=query.gt("id",String(job.cursor_id));
    const {data:requirements,error:requirementError}=await query;if(requirementError)throw new Error("requirements_lookup_failed");const reqs=(requirements||[]) as AlertRequirement[];
    const matches=reqs.filter(req=>matchesPropertyAlert(content.property,req));const userIds=[...new Set(matches.map(req=>req.user_id))];
    if(userIds.length){const [prefs,registrations,history]=await Promise.all([
      service.from("property_alert_preferences").select("user_id").in("user_id",userIds).eq("enabled",true).eq("permission_status","granted"),
      service.from("push_registrations").select("id,user_id").in("user_id",userIds).eq("active",true),
      service.from("push_notification_logs").select("user_id,property_id,registration_id").in("user_id",userIds).eq("notification_type","property_match").gte("created_at",new Date(Date.now()-24*60*60_000).toISOString()).in("status",["queued","processing","sent"]).limit(1000),
    ]);if(prefs.error||registrations.error||history.error)throw new Error("recipient_lookup_failed");
      const enabled=new Set((prefs.data||[]).map(pref=>pref.user_id));const count=new Map<string,Set<string>>();for(const entry of history.data||[]){const set=count.get(entry.user_id)||new Set<string>();set.add(String(entry.property_id||entry.registration_id));count.set(entry.user_id,set)}
      const rows:Row[]=[];const seen=new Set<string>();for(const req of matches){if(!enabled.has(req.user_id))continue;const used=count.get(req.user_id)||new Set<string>();if(used.size>=limitPerUser&&!used.has(propertyId))continue;for(const reg of registrations.data||[]){if(reg.user_id!==req.user_id||seen.has(reg.id))continue;seen.add(reg.id);rows.push({user_id:req.user_id,property_id:propertyId,requirement_id:req.id,registration_id:reg.id,notification_type:"property_match",title:content.title,body:content.body,action_path:content.path,dedupe_key:`property:${propertyId}:registration:${reg.id}`})}}
      if(rows.length){const inserted=await service.from("push_notification_logs").upsert(rows,{onConflict:"dedupe_key",ignoreDuplicates:true});if(inserted.error)throw new Error("push_log_insert_failed")}
    }
    await service.from("push_publish_jobs").update(reqs.length===batchSize?{status:"queued",cursor_id:reqs[reqs.length-1].id,next_attempt_at:tomorrow(),processing_started_at:null}:{status:"complete",cursor_id:reqs.at(-1)?.id||job.cursor_id,completed_at:due(),processing_started_at:null}).eq("id",id);
    return matches.length;
  }catch(error){logEvent("error","push.publish_job_failed",{jobId:id,code:error instanceof Error?error.message:"unknown"});await service.from("push_publish_jobs").update({status:Number(job.attempts||0)>=4?"failed":"queued",next_attempt_at:new Date(Date.now()+Math.min(3600,2**Number(job.attempts||0)*60)*1000).toISOString(),processing_started_at:null}).eq("id",id);return 0}
}

async function deliverLog(service:Service,log:Row){
  const id=String(log.id);const claimed=await service.from("push_notification_logs").update({status:"processing",processing_started_at:due(),attempts:Number(log.attempts||0)+1}).eq("id",id).eq("status","queued").select("id").maybeSingle();if(!claimed.data)return false;
  const [registration,prefs,requirement,property]=await Promise.all([
    service.from("push_registrations").select("id,user_id,fcm_token,active").eq("id",String(log.registration_id)).maybeSingle(),
    service.from("property_alert_preferences").select("enabled,permission_status").eq("user_id",String(log.user_id)).maybeSingle(),
    log.requirement_id?service.from("property_alert_requirements").select("active").eq("id",String(log.requirement_id)).maybeSingle():Promise.resolve({data:{active:true}}),
    log.property_id?service.from("properties").select("status,deleted_at").eq("id",String(log.property_id)).maybeSingle():Promise.resolve({data:{status:"published",deleted_at:null}}),
  ]);
  if(!registration.data?.active||registration.data.user_id!==log.user_id||!prefs.data?.enabled||prefs.data.permission_status!=="granted"||!requirement.data?.active||property.data?.status!=="published"||property.data.deleted_at){await service.from("push_notification_logs").update({status:"skipped",processing_started_at:null,error_code:"no_longer_eligible"}).eq("id",id);return false}
  const path=String(log.action_path);if(!/^\/(property|paying-guest)\/[a-zA-Z0-9-]+$/.test(path)&&path!=="/properties"){await service.from("push_notification_logs").update({status:"skipped",error_code:"invalid_path",processing_started_at:null}).eq("id",id);return false}
  const result=await sendPropertyPush({token:registration.data.fcm_token,title:String(log.title),body:String(log.body),url:path,propertyId:log.property_id?String(log.property_id):null});
  if(result.ok){await service.from("push_notification_logs").update({status:"sent",sent_at:due(),processing_started_at:null,error_code:null}).eq("id",id);return true}
  if(isInvalidFirebaseToken(result.code)){await service.from("push_registrations").update({active:false,updated_at:due()}).eq("id",registration.data.id);await service.from("push_notification_logs").update({status:"failed",error_code:"invalid_registration",processing_started_at:null}).eq("id",id);return false}
  await service.from("push_notification_logs").update({status:Number(log.attempts||0)>=4?"failed":"queued",next_attempt_at:new Date(Date.now()+Math.min(3600,2**Number(log.attempts||0)*60)*1000).toISOString(),error_code:result.code.slice(0,100),processing_started_at:null}).eq("id",id);return false;
}

export async function processPushQueue(service:Service){
  const stale=new Date(Date.now()-5*60_000).toISOString();await Promise.all([
    service.from("push_publish_jobs").update({status:"queued",processing_started_at:null}).eq("status","processing").lt("processing_started_at",stale),
    service.from("push_notification_logs").update({status:"queued",processing_started_at:null}).eq("status","processing").lt("processing_started_at",stale),
  ]);
  const jobs=await service.from("push_publish_jobs").select("id,property_id,cursor_id,attempts").eq("status","queued").lte("next_attempt_at",due()).order("created_at").limit(2);let matched=0;for(const job of jobs.data||[])matched+=await processPublishJob(service,job as Row);
  let sent=0;if(firebaseAdminConfigured()){const logs=await service.from("push_notification_logs").select("id,user_id,property_id,registration_id,requirement_id,notification_type,title,body,action_path,attempts").eq("status","queued").lte("next_attempt_at",due()).order("created_at").limit(10);for(const log of logs.data||[])if(await deliverLog(service,log as Row))sent++}
  return {jobs:(jobs.data||[]).length,matched,sent,configured:firebaseAdminConfigured()};
}
