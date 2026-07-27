import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";
const schema=z.object({action:z.enum(["approve","publish","reject","request_changes"]),reason:z.string().trim().max(2000).optional()});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const parsed=schema.safeParse(await requestData(request));if(!parsed.success)return NextResponse.json({error:"Invalid review action."},{status:400});
  const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const {data:allowed}=await supabase.rpc("has_permission",{required_permission:"pg.manage"});if(!allowed)return NextResponse.json({error:"Permission denied."},{status:403});
  const {data:pg}=await supabase.from("pg_listings").select("property_id").eq("id",id).maybeSingle();if(!pg)return NextResponse.json({error:"PG not found."},{status:404});
  const {error}=await supabase.rpc("review_property",{target_property:pg.property_id,review_action:parsed.data.action,review_reason:parsed.data.reason||null});
  if(error)return NextResponse.json({error:"The PG status could not be changed.",detail:error.message},{status:409});
  return NextResponse.redirect(new URL(`/admin/pg/${id}`,request.url),303);
}
