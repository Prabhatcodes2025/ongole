import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";
import {formList,pgDraftSchema} from "@/src/lib/pg/validation";

export async function POST(request:NextRequest){
  const wantsJson=request.headers.get("accept")?.includes("application/json")===true;
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return wantsJson?NextResponse.json({error:"Authentication required."},{status:401}):NextResponse.redirect(new URL("/login?returnTo=/dashboard/pg/new?restore=1",request.url),303);
  if(!auth.user.email_confirmed_at)return NextResponse.json({error:"Verify your email address before creating a PG listing."},{status:403});
  const {data:permission,error:permissionError}=await supabase.rpc("check_property_posting_permission");
  if(permissionError||!(permission as {allowed?:boolean}|null)?.allowed)return NextResponse.json({error:"ONE FREE PROPERTY PER REGISTERED USER. Contact OngoleProperty.com for an additional posting permission."},{status:409});
  const raw=await requestData(request);
  if(typeof raw.description!=="string"||raw.description.trim().length<20)return NextResponse.json({error:"Check the PG details and try again.",fields:{description:["Description must be at least 20 characters."]}},{status:400});
  const checked=Object.entries(raw).filter(([key,value])=>key.startsWith("amenity_")&&typeof value==="string").map(([,value])=>value as string);
  const parsed=pgDraftSchema.safeParse({...raw,amenities:[...new Set(checked)],house_rules:formList(raw.house_rules),video_urls:formList(raw.video_urls)});
  if(!parsed.success)return NextResponse.json({error:"Check the PG details and try again.",fields:parsed.error.flatten().fieldErrors},{status:400});
  const {data,error}=await supabase.rpc("create_pg_draft",{pg_payload:parsed.data});
  if(error)return NextResponse.json({error:"The PG draft could not be created.",detail:error.message},{status:409});
  const result=data as {id:string};
  if(parsed.data.landmark||parsed.data.lunch_box_available){const{error:landmarkError}=await supabase.from("pg_listings").update({details:{landmark:parsed.data.landmark||null,lunch_box_available:parsed.data.lunch_box_available}}).eq("id",result.id);if(landmarkError)return NextResponse.json({error:"The PG draft was created but its additional details could not be saved."},{status:500})}
  const editUrl=`/dashboard/pg/${result.id}?notice=created`;return wantsJson?NextResponse.json({id:result.id,editUrl},{status:201}):NextResponse.redirect(new URL(editUrl,request.url),303);
}
