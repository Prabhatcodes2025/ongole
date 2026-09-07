import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});if(!auth.user.email_confirmed_at)return NextResponse.json({error:"Verify your email address before submitting a PG listing."},{status:403});
  const {error}=await supabase.rpc("submit_pg_for_review",{target_pg:id});
  if(error)return NextResponse.json({error:error.message==="pg_incomplete"?"Add a complete description, address and at least one room before submitting.":error.message==="PROPERTY_POSTING_LIMIT_REACHED"?"ONE FREE PROPERTY PER REGISTERED USER. Contact OngoleProperty.com for an additional posting permission.":"The PG could not be submitted."},{status:409});
  return NextResponse.redirect(new URL(`/dashboard/pg/${id}?notice=submitted`,request.url),303);
}
