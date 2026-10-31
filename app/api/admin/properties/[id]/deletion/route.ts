import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
import {requestData} from "@/src/lib/request";
import {logEvent} from "@/src/lib/observability/logger";
import {propertyConfirmation} from "@/src/lib/admin/confirmation";

const schema=z.object({action:z.enum(["soft_delete","restore","permanent_delete"]),confirmation:z.string().min(1).max(200)});

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const parsed=schema.safeParse(await requestData(request));if(!parsed.success)return NextResponse.json({error:"Confirm the property action."},{status:400});
  const{id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Property not found."},{status:404});
  const supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:property}=await supabase.from("properties").select("reference_no,title,property_media(storage_path),pg_listings(id)").eq("id",id).maybeSingle();if(!property)return NextResponse.json({error:"Property not found."},{status:404});
  if(Array.isArray(property.pg_listings)?property.pg_listings.length>0:Boolean(property.pg_listings))return NextResponse.json({error:"Use the Paying Guest administration controls for this record."},{status:409});
  const permanent=parsed.data.action==="permanent_delete",expected=propertyConfirmation(property.reference_no,permanent),confirmation=parsed.data.confirmation;if(confirmation!==expected)return NextResponse.json({error:`Type ${expected} exactly to confirm (case and spaces must match).`},{status:400});
  const{error}=await supabase.rpc("admin_manage_property_deletion",{target_property:id,deletion_action:parsed.data.action,confirmation_text:confirmation});
  if(error){logEvent("warn","admin.property_deletion_failed",{propertyId:id,action:parsed.data.action,code:error.code});const conflict=error.message.includes("retention_required")?"Permanent deletion is blocked by linked enquiries, payments, promotions, or posting-retention records. Keep the property archived.":error.message.includes("soft_delete_required")?"Archive the property before permanently deleting it.":error.message.includes("super_admin_required")?"Only a Super Administrator can permanently delete a property.":error.message.includes("confirmation_mismatch")?`Type ${expected} exactly to confirm (case and spaces must match).`:"The property action could not be completed.";return NextResponse.json({error:conflict},{status:409})}
  if(parsed.data.action==="permanent_delete"){const paths=(property.property_media||[]).map((item:{storage_path:string})=>item.storage_path).filter(Boolean),service=createSupabaseServiceClient();if(paths.length&&service){const{error:storageError}=await service.storage.from("property-media").remove(paths);if(storageError)logEvent("warn","admin.property_storage_cleanup_failed",{propertyId:id,count:paths.length,code:storageError.name})}}
  return NextResponse.redirect(new URL(`/admin/properties?notice=${parsed.data.action}`,request.url),303);
}
