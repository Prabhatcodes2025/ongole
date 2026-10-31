import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";
import {logEvent} from "@/src/lib/observability/logger";

const schema=z.object({action:z.enum(["archive","restore"]),ids:z.union([z.array(z.string().uuid()).min(1).max(100),z.string().uuid().transform(value=>[value])]),confirmation:z.string()});
export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid origin."},{status:403});
  const supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"enquiries.manage"});if(!allowed)return NextResponse.json({error:"Permission denied."},{status:403});
  const parsed=schema.safeParse(await requestData(request));if(!parsed.success||parsed.data.confirmation!==parsed.data.action.toUpperCase())return NextResponse.json({error:"Select enquiries and confirm the requested action."},{status:400});
  const ids=[...new Set(parsed.data.ids)],{data:rows}=await supabase.from("enquiries").select("id,reference_no,archived_at").in("id",ids),byId=new Map((rows||[]).map(row=>[row.id,row])),results:{id:string;reference?:string;ok:boolean;error?:string}[]=[];
  for(const id of ids){const row=byId.get(id);if(!row){results.push({id,ok:false,error:"Enquiry not found."});continue}const eligible=parsed.data.action==="archive"?!row.archived_at:Boolean(row.archived_at);if(!eligible){results.push({id,reference:row.reference_no,ok:false,error:parsed.data.action==="archive"?"Enquiry is already archived.":"Enquiry is not archived."});continue}const{error}=await supabase.rpc("manage_enquiry_archive",{target_ids:[id],archive_action:parsed.data.action});if(error){logEvent("warn","admin.enquiry_bulk_item_failed",{code:error.code,action:parsed.data.action,enquiryId:id});results.push({id,reference:row.reference_no,ok:false,error:error.message.includes("permission_denied")?"Permission denied.":"The database rejected this action."})}else results.push({id,reference:row.reference_no,ok:true})}
  const succeeded=results.filter(item=>item.ok).length,failed=results.length-succeeded;if(!request.headers.get("accept")?.includes("application/json")&&succeeded&&!failed)return NextResponse.redirect(new URL("/admin/enquiries",request.url),303);return NextResponse.json({results,succeeded,failed},{status:succeeded?200:409});
}
