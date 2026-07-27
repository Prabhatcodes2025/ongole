import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";
import {pgRoomSchema} from "@/src/lib/pg/validation";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const parsed=pgRoomSchema.safeParse(await requestData(request));
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Check the room details."},{status:400});
  const {data:pg}=await supabase.from("pg_listings").select("id,property_id,properties!inner(owner_id,status)").eq("id",id).eq("properties.owner_id",auth.user.id).maybeSingle();
  const status=(pg?.properties as unknown as {status?:string}|null)?.status;
  if(!pg||!["draft","changes_requested"].includes(status||""))return NextResponse.json({error:"This PG is locked."},{status:403});
  const {count}=await supabase.from("pg_room_types").select("id",{count:"exact",head:true}).eq("pg_listing_id",id);
  const {error}=await supabase.from("pg_room_types").insert({...parsed.data,pg_listing_id:id,sort_order:count||0});
  if(error)return NextResponse.json({error:"The room could not be added."},{status:409});
  return NextResponse.redirect(new URL(`/dashboard/pg/${id}?notice=room-added`,request.url),303);
}
