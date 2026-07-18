import {NextRequest,NextResponse} from "next/server";
import {env} from "@/src/lib/env";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {logEvent} from "@/src/lib/observability/logger";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  const requestId=request.headers.get("x-request-id")||crypto.randomUUID();
  const services={database:env.isSupabaseConfigured?"reachable":"not_configured",smtp:env.smtp.host&&env.smtp.from?"configured":"disabled",redis:env.redisUrl&&env.redisToken?"configured":"fallback",captcha:env.captchaSecret&&env.captchaSiteKey?"configured":"disabled",maps:env.googleMapsKey?"configured":"disabled",analytics:env.gaMeasurementId?"configured":"disabled",errorReporting:env.sentryDsn?"configured":"logs_only"};
  const response=(status:"ok"|"degraded",database:"not_configured"|"reachable"|"schema_ready"|"degraded"|"unavailable",httpStatus=200)=>NextResponse.json({status,requestId,services:{...services,database},checkedAt:new Date().toISOString()},{status:httpStatus,headers:{"Cache-Control":"no-store"}});
  if(!env.isSupabaseConfigured)return response("degraded","not_configured",503);
  try{
    const supabase=await createSupabaseServerClient();
    const {data:ready,error:schemaError}=await supabase.rpc("is_application_schema_ready");
    if(!schemaError&&ready===true)return response("ok","schema_ready");
    const {error:pingError}=await supabase.from("feature_flags").select("key",{head:true,count:"exact"}).limit(1);
    if(pingError)throw pingError;
    logEvent("warn","health.schema_not_ready",{requestId,probeAvailable:!schemaError});
    return response("degraded",schemaError?"reachable":"degraded",503);
  }catch{
    logEvent("error","health.database_unavailable",{requestId});
    return response("degraded","unavailable",503);
  }
}
