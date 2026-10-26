import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {normalizeAdminConfirmation} from "@/src/lib/admin/confirmation";
import {logEvent} from "@/src/lib/observability/logger";
import {requestData} from "@/src/lib/request";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

const schema=z.object({confirmation:z.string().min(1).max(200)});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const{id}=await params;if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Enquiry not found."},{status:404});
  const parsed=schema.safeParse(await requestData(request));if(!parsed.success)return NextResponse.json({error:"Type the enquiry reference to confirm."},{status:400});
  const supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:enquiry}=await supabase.from("enquiries").select("reference_no,archived_at").eq("id",id).maybeSingle();if(!enquiry)return NextResponse.json({error:"Enquiry not found."},{status:404});
  const confirmation=normalizeAdminConfirmation(parsed.data.confirmation),expected=normalizeAdminConfirmation(`DELETE ${enquiry.reference_no}`);if(confirmation!==expected)return NextResponse.json({error:`Type DELETE ${enquiry.reference_no} to confirm.`},{status:400});
  const{error}=await supabase.rpc("admin_permanently_delete_enquiry",{target_enquiry:id,confirmation_text:confirmation});
  if(error){logEvent("warn","admin.enquiry_permanent_delete_failed",{enquiryId:id,code:error.code});const message=error.message.includes("super_admin_required")?"Only a Super Administrator can permanently delete an enquiry.":error.message.includes("archive_required")?"Archive the enquiry before permanent deletion.":error.message.includes("retention_required")?"This enquiry must be retained because it is linked to a user, property, or retention period.":"The enquiry could not be permanently deleted.";return NextResponse.json({error:message},{status:409})}
  return NextResponse.redirect(new URL("/admin/enquiries?lifecycle=archived&notice=permanently_deleted",request.url),303);
}
