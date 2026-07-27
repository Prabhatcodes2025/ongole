import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {requestIp} from "@/src/lib/request";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
const events=["page_view","listing_view","search_impression","enquiry_submitted","phone_click","whatsapp_click","share_click","favorite","promotion_impression","promotion_click"] as const;
const schema=z.object({eventType:z.enum(events),entityType:z.enum(["property","pg","promotion","page"]).optional(),entityId:z.string().uuid().optional(),metadata:z.record(z.string(),z.union([z.string().max(100),z.number(),z.boolean()])).optional()});
export async function POST(request:NextRequest){
  const rate=await checkRateLimit(`analytics:${requestIp(request)}`,120,60_000);if(!rate.allowed)return new NextResponse(null,{status:204});
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return new NextResponse(null,{status:204});
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return new NextResponse(null,{status:204});
  const service=createSupabaseServiceClient();if(!service)return new NextResponse(null,{status:204});
  let entityId=parsed.data.entityId;
  if(!entityId&&["property","pg"].includes(parsed.data.entityType||"")&&typeof parsed.data.metadata?.slug==="string"){const{data}=await service.from("properties").select("id").eq("slug",parsed.data.metadata.slug).eq("status","published").is("deleted_at",null).maybeSingle();entityId=data?.id}
  if(["property","pg"].includes(parsed.data.entityType||"")){if(!entityId)return new NextResponse(null,{status:204});const{data}=await service.from("properties").select("id,status,deleted_at").eq("id",entityId).eq("status","published").is("deleted_at",null).maybeSingle();if(!data)return new NextResponse(null,{status:204})}
  const sessionHash=createHash("sha256").update(`${new Date().toISOString().slice(0,10)}:${requestIp(request)}`).digest("hex").slice(0,32);
  await service.from("analytics_events").insert({event_type:parsed.data.eventType,entity_type:parsed.data.entityType||null,entity_id:entityId||null,session_hash:sessionHash,metadata:parsed.data.metadata||{}});
  return new NextResponse(null,{status:204});
}
