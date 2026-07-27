import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";
import {formList,pgDraftSchema} from "@/src/lib/pg/validation";

export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.redirect(new URL("/login?returnTo=/dashboard/pg/new",request.url),303);
  const {data:planCheck,error:planError}=await supabase.rpc("check_listing_plan_limit",{target_kind:"paying_guest"});
  if(planError||!(planCheck as {allowed?:boolean}|null)?.allowed)return NextResponse.redirect(new URL("/pricing?reason=pg-listing-limit",request.url),303);
  const raw=await requestData(request);
  const checked=Object.entries(raw).filter(([key,value])=>key.startsWith("amenity_")&&typeof value==="string").map(([,value])=>value as string);
  const parsed=pgDraftSchema.safeParse({...raw,amenities:[...new Set(checked)],house_rules:formList(raw.house_rules),video_urls:formList(raw.video_urls)});
  if(!parsed.success)return NextResponse.json({error:"Check the PG details and try again.",fields:parsed.error.flatten().fieldErrors},{status:400});
  const {data,error}=await supabase.rpc("create_pg_draft",{pg_payload:parsed.data});
  if(error)return NextResponse.json({error:"The PG draft could not be created.",detail:error.message},{status:409});
  const result=data as {id:string};
  return NextResponse.redirect(new URL(`/dashboard/pg/${result.id}?notice=created`,request.url),303);
}
