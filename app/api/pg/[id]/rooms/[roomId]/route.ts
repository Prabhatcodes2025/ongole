import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;roomId:string}>}){
  const {id,roomId}=await params;
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const raw=await requestData(request);
  if(raw.action!=="delete")return NextResponse.json({error:"Invalid room action."},{status:400});
  const [{data:pg},{data:canManage}]=await Promise.all([supabase.from("pg_listings").select("id,properties!inner(owner_id,status)").eq("id",id).maybeSingle(),supabase.rpc("has_permission",{required_permission:"pg.manage"})]);
  const status=(pg?.properties as unknown as {status?:string}|null)?.status;
  const ownerId=(pg?.properties as unknown as {owner_id?:string}|null)?.owner_id;
  if(!pg||(ownerId!==auth.user.id&&canManage!==true)||(canManage!==true&&!["draft","changes_requested"].includes(status||"")))return NextResponse.json({error:"This PG is locked."},{status:403});
  const {error}=await supabase.from("pg_room_types").delete().eq("id",roomId).eq("pg_listing_id",id);
  if(error)return NextResponse.json({error:"The room could not be removed."},{status:409});
  await supabase.rpc("record_audit_event",{event_action:"pg.room_removed",event_type:"pg_listing",event_reference:id,event_old:{room_id:roomId,admin_override:canManage===true}});
  return NextResponse.redirect(new URL(`/dashboard/pg/${id}?notice=room-removed`,request.url),303);
}
