import type {SupabaseClient} from "@supabase/supabase-js";
import {sendNotificationEmail} from "@/src/lib/email/service";
import {logEvent} from "@/src/lib/observability/logger";

const BATCH_SIZE=25;
const MAX_ATTEMPTS=5;

type Delivery={
  id:string;
  notification_id:string|null;
  recipient:string|null;
  attempts:number;
};

type Notification={
  id:string;
  user_id:string;
  title:string;
  body:string;
};

type OutboxItem={
  id:string;
  event_type:string;
  recipient:string;
  payload:Record<string,unknown>;
  attempts:number;
};

export type QueueResult={processed:number;sent:number;failed:number;retried:number};

function retryAt(attempt:number){
  const delayMinutes=[5,30,120,720][Math.min(Math.max(attempt-1,0),3)];
  return new Date(Date.now()+delayMinutes*60_000).toISOString();
}

function errorCode(disabled:boolean){
  return disabled?"smtp_disabled":"smtp_delivery_failed";
}

export async function processNotificationDeliveries(service:SupabaseClient):Promise<QueueResult>{
  const result:QueueResult={processed:0,sent:0,failed:0,retried:0};
  const now=new Date().toISOString();
  const staleBefore=new Date(Date.now()-15*60_000).toISOString();
  await service.from("notification_deliveries").update({
    status:"queued",
    processing_started_at:null,
    error_code:"stale_claim_recovered",
  }).eq("channel","email").eq("status","processing").lt("processing_started_at",staleBefore).lt("attempts",MAX_ATTEMPTS);
  const {data,error}=await service
    .from("notification_deliveries")
    .select("id,notification_id,recipient,attempts")
    .eq("channel","email")
    .eq("status","queued")
    .lte("next_attempt_at",now)
    .order("next_attempt_at",{ascending:true})
    .limit(BATCH_SIZE);
  if(error)throw new Error(`notification_delivery_query_failed:${error.code||"unknown"}`);

  for(const delivery of (data||[]) as Delivery[]){
    const attempt=delivery.attempts+1;
    const {data:claim}=await service
      .from("notification_deliveries")
      .update({status:"processing",attempts:attempt,processing_started_at:new Date().toISOString()})
      .eq("id",delivery.id)
      .eq("status","queued")
      .select("id")
      .maybeSingle();
    if(!claim)continue;
    result.processed+=1;

    const {data:notification}=delivery.notification_id
      ? await service.from("notifications").select("id,user_id,title,body").eq("id",delivery.notification_id).maybeSingle()
      : {data:null};
    const item=notification as Notification|null;
    const {data:profile}=item
      ? await service.from("profiles").select("email").eq("id",item.user_id).maybeSingle()
      : {data:null};
    const recipient=delivery.recipient||profile?.email;

    if(!item||!recipient){
      await service.from("notification_deliveries").update({
        status:"failed",
        error_code:!item?"notification_missing":"recipient_missing",
        processing_started_at:null,
      }).eq("id",delivery.id).eq("status","processing");
      result.failed+=1;
      continue;
    }

    const sent=await sendNotificationEmail(recipient,item.title,item.body);
    if(sent.sent){
      await service.from("notification_deliveries").update({
        status:"sent",
        sent_at:new Date().toISOString(),
        error_code:null,
        processing_started_at:null,
      }).eq("id",delivery.id).eq("status","processing");
      result.sent+=1;
    }else if(attempt>=MAX_ATTEMPTS){
      await service.from("notification_deliveries").update({
        status:"failed",
        error_code:errorCode(sent.disabled),
        processing_started_at:null,
      }).eq("id",delivery.id).eq("status","processing");
      result.failed+=1;
    }else{
      await service.from("notification_deliveries").update({
        status:"queued",
        error_code:errorCode(sent.disabled),
        next_attempt_at:retryAt(attempt),
        processing_started_at:null,
      }).eq("id",delivery.id).eq("status","processing");
      result.retried+=1;
    }
  }
  return result;
}

function outboxContent(item:OutboxItem){
  const reference=typeof item.payload.reference_no==="string"?item.payload.reference_no:"";
  if(item.event_type==="enquiry.created"){
    return{
      subject:reference?`New property enquiry ${reference}`:"New property enquiry",
      body:reference?`A new enquiry (${reference}) is ready for review in the admin dashboard.`:"A new enquiry is ready for review in the admin dashboard.",
    };
  }
  return{subject:"OngoleProperty.com notification",body:"A new account notification is ready for review."};
}

export async function processLegacyOutbox(service:SupabaseClient):Promise<QueueResult>{
  const result:QueueResult={processed:0,sent:0,failed:0,retried:0};
  const staleBefore=new Date(Date.now()-15*60_000).toISOString();
  await service.from("notification_outbox").update({
    status:"pending",
    processing_started_at:null,
    last_error:"stale_claim_recovered",
  }).eq("status","processing").lt("processing_started_at",staleBefore).lt("attempts",MAX_ATTEMPTS);
  const {data,error}=await service
    .from("notification_outbox")
    .select("id,event_type,recipient,payload,attempts")
    .eq("status","pending")
    .lte("next_attempt_at",new Date().toISOString())
    .order("next_attempt_at",{ascending:true})
    .limit(BATCH_SIZE);
  if(error)throw new Error(`notification_outbox_query_failed:${error.code||"unknown"}`);

  for(const item of (data||[]) as OutboxItem[]){
    const attempt=item.attempts+1;
    const {data:claim}=await service.from("notification_outbox")
      .update({status:"processing",attempts:attempt,processing_started_at:new Date().toISOString()})
      .eq("id",item.id)
      .eq("status","pending")
      .select("id")
      .maybeSingle();
    if(!claim)continue;
    result.processed+=1;

    const content=outboxContent(item);
    const sent=await sendNotificationEmail(item.recipient,content.subject,content.body);
    if(sent.sent){
      await service.from("notification_outbox").update({
        status:"sent",
        sent_at:new Date().toISOString(),
        last_error:null,
        processing_started_at:null,
      }).eq("id",item.id).eq("status","processing");
      result.sent+=1;
    }else if(attempt>=MAX_ATTEMPTS){
      await service.from("notification_outbox").update({
        status:"failed",
        last_error:errorCode(sent.disabled),
        processing_started_at:null,
      }).eq("id",item.id).eq("status","processing");
      result.failed+=1;
    }else{
      await service.from("notification_outbox").update({
        status:"pending",
        last_error:errorCode(sent.disabled),
        next_attempt_at:retryAt(attempt),
        processing_started_at:null,
      }).eq("id",item.id).eq("status","processing");
      result.retried+=1;
    }
  }
  return result;
}

export function logQueueResult(queue:string,result:QueueResult,requestId:string){
  logEvent(result.failed?"warn":"info","cron.notification_queue_processed",{queue,requestId,...result});
}
