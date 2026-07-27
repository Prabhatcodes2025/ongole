import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {requestIp} from "@/src/lib/request";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";

export async function POST(request:NextRequest){
  const rate=await checkRateLimit(`search-analytics:${requestIp(request)}`,60,60_000);
  if(!rate.allowed)return new NextResponse(null,{status:204});
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return new NextResponse(null,{status:204});
  const payload=await request.json().catch(()=>null) as {query?:Record<string,unknown>;resultCount?:number}|null;
  if(!payload?.query)return new NextResponse(null,{status:204});
  const allowed=["q","purpose","category","type","location","minPrice","maxPrice","minArea","maxArea","sort"];
  const query=Object.fromEntries(allowed.flatMap((key)=>typeof payload.query?.[key]==="string"?[[key,String(payload.query[key]).slice(0,100)]]:[]));
  const service=createSupabaseServiceClient();
  if(service)await service.from("analytics_events").insert({event_type:"search_impression",entity_type:"page",session_hash:createHash("sha256").update(requestIp(request)).digest("hex").slice(0,32),metadata:{query,result_count:Math.max(0,Math.min(100000,Number(payload.resultCount)||0))}});
  return new NextResponse(null,{status:204});
}
