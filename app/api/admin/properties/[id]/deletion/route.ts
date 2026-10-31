import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
import {requestData} from "@/src/lib/request";
import {logEvent} from "@/src/lib/observability/logger";
import {propertyConfirmation} from "@/src/lib/admin/confirmation";
import {propertyDeletionBlockers} from "@/src/lib/admin/property-deletion-blockers";

const schema=z.object({action:z.enum(["soft_delete","restore","permanent_delete"]),confirmation:z.string().min(1).max(200)});

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const parsed=schema.safeParse(await requestData(request));if(!parsed.success)return NextResponse.json({error:"Confirm the property action."},{status:400});
  const{id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Property not found."},{status:404});
  const supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:property}=await supabase.from("properties").select("reference_no,title,status,deleted_at,property_media(storage_path),pg_listings(id)").eq("id",id).maybeSingle();if(!property)return NextResponse.json({error:"Property not found."},{status:404});
  if(Array.isArray(property.pg_listings)?property.pg_listings.length>0:Boolean(property.pg_listings))return NextResponse.json({error:"Use the Paying Guest administration controls for this record."},{status:409});
  const permanent=parsed.data.action==="permanent_delete",expected=propertyConfirmation(property.reference_no,permanent),confirmation=parsed.data.confirmation;if(confirmation!==expected)return NextResponse.json({error:`Type ${expected} exactly to confirm (case and spaces must match).`},{status:400});
  if(permanent){const{data:context}=await supabase.rpc("get_current_auth_context"),roles=Array.isArray(context?.roles)?context.roles:[],isSuperAdmin=roles.some((role:unknown)=>typeof role==="string"?role==="super_admin":Boolean(role&&typeof role==="object"&&"code" in role&&(role as{code:string}).code==="super_admin"));if(!isSuperAdmin)return NextResponse.json({error:"Only a Super Administrator can permanently delete a property."},{status:403});if(!property.deleted_at||property.status!=="archived")return NextResponse.json({error:"Soft Delete the property before permanently deleting it.",code:"soft_delete_required"},{status:409});const service=createSupabaseServiceClient(),blockers=service?await propertyDeletionBlockers(service,id):[];if(blockers.length)return NextResponse.json({error:`Permanent deletion is blocked by ${blockers.join(", ")}.`,code:"retention_required"},{status:409})}
  const{error}=await supabase.rpc("admin_manage_property_deletion",{target_property:id,deletion_action:parsed.data.action,confirmation_text:confirmation});
  if(error){logEvent("warn", "admin.property_deletion_failed", {
  propertyId: id,
  action: parsed.data.action,
  code: error.code,
  message: error.message,
  details: error.details,
  hint: error.hint,
});const conflict=error.message.includes("retention_required:enquiries")?"Permanent deletion is blocked by linked enquiries. Keep the property archived.":error.message.includes("retention_required:promotions")?"Permanent deletion is blocked by promotion history. Keep the property archived.":error.message.includes("retention_required:payments")?"Permanent deletion is blocked by payment orders. Keep the property archived.":error.message.includes("retention_required")?"Permanent deletion is blocked by a retained business record. Keep the property archived.":error.message.includes("soft_delete_required")?"Soft Delete the property before permanently deleting it.":error.message.includes("super_admin_required")?"Only a Super Administrator can permanently delete a property.":error.message.includes("confirmation_mismatch")?`Type ${expected} exactly to confirm (case and spaces must match).`:"The property action could not be completed.";return NextResponse.json({error:conflict,code:error.message.match(/retention_required:([a-z_]+)/)?.[1]||error.code},{status:409})}
  if(parsed.data.action==="permanent_delete"){const paths=(property.property_media||[]).map((item:{storage_path:string})=>item.storage_path).filter(Boolean),service=createSupabaseServiceClient(),verification=service?await service.from("properties").select("id").eq("id",id).maybeSingle():await supabase.from("properties").select("id").eq("id",id).maybeSingle();if(verification.error||verification.data){logEvent("error","admin.property_delete_verification_failed",{propertyId:id,code:verification.error?.code});return NextResponse.json({error:"The deletion response could not be verified against the database.",code:"verification_failed"},{status:500})}if(paths.length&&service){const{error:storageError}=await service.storage.from("property-media").remove(paths);if(storageError)logEvent("warn","admin.property_storage_cleanup_failed",{propertyId:id,count:paths.length,code:storageError.name})}return NextResponse.json({success:true,physicallyDeleted:true,id,reference:property.reference_no})}
  return NextResponse.redirect(new URL(`/admin/properties?notice=${parsed.data.action}`,request.url),303);
}
