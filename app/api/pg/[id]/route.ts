import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";
import {formList,pgDraftSchema} from "@/src/lib/pg/validation";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const raw=await requestData(request);
  const action=typeof raw.action==="string"?raw.action:"update";
  if(action==="duplicate"){
    const {data,error}=await supabase.rpc("duplicate_pg_listing",{target_pg:id});
    if(error)return NextResponse.json({error:"The PG could not be duplicated."},{status:409});
    return NextResponse.redirect(new URL(`/dashboard/pg/${(data as {id:string}).id}?notice=duplicated`,request.url),303);
  }
  const {data:pg}=await supabase.from("pg_listings").select("property_id,properties!inner(owner_id,status)").eq("id",id).eq("properties.owner_id",auth.user.id).maybeSingle();
  if(!pg)return NextResponse.json({error:"PG listing not found."},{status:404});
  if(action==="delete"){
    const {error}=await supabase.rpc("owner_soft_delete_property",{target_property:pg.property_id});
    if(error)return NextResponse.json({error:"This PG cannot be deleted in its current state."},{status:409});
    return NextResponse.redirect(new URL("/dashboard/pg?notice=deleted",request.url),303);
  }
  const checked=Object.entries(raw).filter(([key,value])=>key.startsWith("amenity_")&&typeof value==="string").map(([,value])=>value as string);
  const parsed=pgDraftSchema.safeParse({...raw,amenities:[...new Set(checked)],house_rules:formList(raw.house_rules),video_urls:formList(raw.video_urls)});
  if(!parsed.success)return NextResponse.json({error:"Check the PG details and try again.",fields:parsed.error.flatten().fieldErrors},{status:400});
  const {error}=await supabase.rpc("update_pg_draft",{target_pg:id,pg_payload:parsed.data});
  if(error)return NextResponse.json({error:"The PG draft could not be updated.",detail:error.message},{status:409});
  return NextResponse.redirect(new URL(`/dashboard/pg/${id}?notice=updated`,request.url),303);
}
