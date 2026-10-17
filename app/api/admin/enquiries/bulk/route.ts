import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {logEvent} from "@/src/lib/observability/logger";

const id=z.string().uuid();
export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid origin."},{status:403});
  const supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"enquiries.manage"});if(!allowed)return NextResponse.json({error:"Permission denied."},{status:403});
  const form=await request.formData(),action=form.get("action"),ids=form.getAll("ids").map(String).filter(value=>id.safeParse(value).success).slice(0,100);
  if(!["archive","restore"].includes(String(action))||ids.length===0||form.get("confirmation")!==String(action).toUpperCase())return NextResponse.json({error:"Select enquiries and confirm the requested action."},{status:400});
  const{error}=await supabase.rpc("manage_enquiry_archive",{target_ids:ids,archive_action:action as string});
  if(error){logEvent("error","admin.enquiry_archive_failed",{code:error.code,action,count:ids.length});return NextResponse.json({error:"The selected enquiries could not be updated."},{status:500})}
  return NextResponse.redirect(new URL("/admin/enquiries",request.url),303);
}
