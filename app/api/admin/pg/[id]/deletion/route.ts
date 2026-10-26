import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {normalizeAdminConfirmation,propertyConfirmation} from "@/src/lib/admin/confirmation";
import {logEvent} from "@/src/lib/observability/logger";
import {requestData} from "@/src/lib/request";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";

const schema=z.object({action:z.enum(["soft_delete","restore","permanent_delete"]),confirmation:z.string().trim().min(1).max(200)});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const{id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"PG listing not found."},{status:404});const parsed=schema.safeParse(await requestData(request));if(!parsed.success)return NextResponse.json({error:"Confirm the PG action."},{status:400});
  const supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:pg}=await supabase.from("pg_listings").select("property_id,properties!inner(reference_no,property_media(storage_path))").eq("id",id).maybeSingle();const property=pg?(Array.isArray(pg.properties)?pg.properties[0]:pg.properties):null;if(!pg||!property)return NextResponse.json({error:"PG listing not found."},{status:404});
  const permanent=parsed.data.action==="permanent_delete",confirmation=normalizeAdminConfirmation(parsed.data.confirmation),expected=propertyConfirmation(property.reference_no,permanent);if(confirmation!==expected)return NextResponse.json({error:`Type ${permanent?"DELETE ":""}${property.reference_no} to confirm.`},{status:400});
  const{error}=await supabase.rpc("admin_manage_pg_deletion",{target_pg:id,deletion_action:parsed.data.action,confirmation_text:confirmation});if(error){logEvent("warn","admin.pg_deletion_failed",{pgId:id,code:error.code,action:parsed.data.action});const message=error.message.includes("super_admin_required")?"Only a Super Administrator can permanently delete a PG listing.":error.message.includes("retention_required")?"This PG listing has retained enquiries, promotion, or posting records and must remain archived.":"The PG action could not be completed.";return NextResponse.json({error:message},{status:409})}
  if(permanent){const paths=(property.property_media||[]).map((item:{storage_path:string})=>item.storage_path).filter(Boolean),service=createSupabaseServiceClient();if(paths.length&&service)await service.storage.from("property-media").remove(paths)}
  return NextResponse.redirect(new URL(`/admin/pg?notice=${parsed.data.action}`,request.url),303);
}
