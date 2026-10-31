import {after,NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";
import {logEvent} from "@/src/lib/observability/logger";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
import {processPushQueue} from "@/src/lib/property-alerts/dispatch";

const actions=["publish","archive","activate","deactivate","feature","unfeature","verify","unverify","pin","unpin"] as const;
const schema=z.object({action:z.enum(actions),ids:z.union([z.array(z.string().uuid()).min(1).max(100),z.string().uuid().transform(value=>[value])])});
type Result={id:string;reference?:string;ok:boolean;error?:string};
function eligibility(action:string,status:string){if(action==="publish"&&status!=="approved")return"Only approved properties can be published.";if(["archive","deactivate"].includes(action)&&["archived","sold","rented","leased"].includes(status))return`A ${status} property cannot be archived again.`;if(action==="activate"&&status!=="archived")return"Only archived properties can be restored.";return null}
function rpcMessage(message:string){return message.includes("not_authorized")?"Permission denied.":message.includes("invalid_action")?"This action is not supported.":"The database rejected this action."}

export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid origin."},{status:403});
  const supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"properties.manage"});if(!allowed)return NextResponse.json({error:"Permission denied."},{status:403});
  const parsed=schema.safeParse(await requestData(request));if(!parsed.success)return NextResponse.json({error:"Choose a valid action and 1–100 properties."},{status:400});
  const ids=[...new Set(parsed.data.ids)],{data:rows}=await supabase.from("properties").select("id,reference_no,status,pg_listings(id)").in("id",ids),byId=new Map((rows||[]).map(row=>[row.id,row])),results:Result[]=[];
  for(const id of ids){const row=byId.get(id);if(!row){results.push({id,ok:false,error:"Property not found."});continue}if(Array.isArray(row.pg_listings)&&row.pg_listings.length){results.push({id,reference:row.reference_no,ok:false,error:"Use PG administration for this listing."});continue}const blocked=eligibility(parsed.data.action,row.status);if(blocked){results.push({id,reference:row.reference_no,ok:false,error:blocked});continue}const{error}=await supabase.rpc("admin_bulk_property_action",{target_properties:[id],bulk_action:parsed.data.action});if(error){logEvent("warn","admin.property_bulk_item_failed",{code:error.code,action:parsed.data.action,propertyId:id});results.push({id,reference:row.reference_no,ok:false,error:rpcMessage(error.message)})}else results.push({id,reference:row.reference_no,ok:true})}
  const succeeded=results.filter(item=>item.ok).length,failed=results.length-succeeded;if(parsed.data.action==="publish"&&succeeded)after(async()=>{const service=createSupabaseServiceClient();if(service)await processPushQueue(service)});if(!request.headers.get("accept")?.includes("application/json")&&succeeded&&!failed)return NextResponse.redirect(new URL("/admin/properties",request.url),303);return NextResponse.json({results,succeeded,failed},{status:succeeded?200:409});
}
