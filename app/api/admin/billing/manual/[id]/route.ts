import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {requestData} from "@/src/lib/request";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
const schema=z.object({decision:z.enum(["approve","reject","request_clarification"]),note:z.string().trim().min(3).max(2000)});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const parsed=schema.safeParse(await requestData(request));if(!parsed.success)return NextResponse.json({error:"A review decision and note are required."},{status:400});
  const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"payments.manage"});if(!allowed)return NextResponse.json({error:"Permission denied."},{status:403});
  const{error}=await supabase.rpc("review_manual_payment",{target_request:id,review_decision:parsed.data.decision,review_comment:parsed.data.note});if(error)return NextResponse.json({error:"The payment review failed.",detail:error.message},{status:409});
  return NextResponse.redirect(new URL("/admin/billing/manual",request.url),303);
}
