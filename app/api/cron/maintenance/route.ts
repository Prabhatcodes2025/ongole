import {timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {env} from "@/src/lib/env";
import {processLegacyOutbox,processNotificationDeliveries,logQueueResult} from "@/src/lib/jobs/notifications";
import {logEvent} from "@/src/lib/observability/logger";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;

function authorized(request:NextRequest){
  const expected=env.cronSecret;
  const supplied=request.headers.get("authorization")||"";
  if(!expected)return false;
  const expectedHeader=`Bearer ${expected}`;
  const suppliedBuffer=Buffer.from(supplied);
  const expectedBuffer=Buffer.from(expectedHeader);
  return suppliedBuffer.length===expectedBuffer.length&&timingSafeEqual(suppliedBuffer,expectedBuffer);
}

export async function GET(request:NextRequest){
  const requestId=request.headers.get("x-vercel-id")||request.headers.get("x-request-id")||crypto.randomUUID();
  if(!authorized(request)){
    logEvent("warn","cron.unauthorized",{requestId});
    return NextResponse.json({error:"Unauthorized",requestId},{status:401,headers:{"Cache-Control":"no-store"}});
  }

  const service=createSupabaseServiceClient();
  if(!service){
    logEvent("error","cron.service_unavailable",{requestId});
    return NextResponse.json({error:"Scheduler service is not configured.",requestId},{status:503,headers:{"Cache-Control":"no-store"}});
  }

  try{
    const targetDay=new Date(Date.now()-86_400_000).toISOString().slice(0,10);
    const [expiry,promotions,analytics]=await Promise.all([
      service.rpc("enqueue_expiry_notifications"),
      service.rpc("expire_promotions"),
      service.rpc("aggregate_analytics",{target_day:targetDay}),
    ]);
    const maintenanceError=expiry.error||promotions.error||analytics.error;
    if(maintenanceError)throw new Error(`maintenance_rpc_failed:${maintenanceError.code||"unknown"}`);

    const deliveries=await processNotificationDeliveries(service);
    const outbox=await processLegacyOutbox(service);
    logQueueResult("notification_deliveries",deliveries,requestId);
    logQueueResult("notification_outbox",outbox,requestId);
    logEvent("info","cron.maintenance_completed",{requestId,expiryNotifications:expiry.data,expiredPromotions:promotions.data,analyticsRows:analytics.data});

    return NextResponse.json({
      status:"ok",
      requestId,
      maintenance:{expiryNotifications:expiry.data,expiredPromotions:promotions.data,analyticsRows:analytics.data},
      queues:{notificationDeliveries:deliveries,legacyOutbox:outbox},
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    logEvent("error","cron.maintenance_failed",{requestId,error:error instanceof Error?error.message:"unknown"});
    return NextResponse.json({error:"Scheduled maintenance failed.",requestId},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
