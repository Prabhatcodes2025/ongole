import { NextRequest,NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { requestData } from "@/src/lib/request";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;mediaId:string}>}){
  const {id,mediaId}=await params;const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const {data:property}=await supabase.from("properties").select("id,reference_no,status").eq("id",id).eq("owner_id",auth.user.id).maybeSingle();if(!property||!["draft","changes_requested"].includes(property.status))return NextResponse.json({error:"Media is locked."},{status:403});
  const {data:media}=await supabase.from("property_media").select("id,storage_path,is_cover,sort_order,variants").eq("id",mediaId).eq("property_id",id).maybeSingle();if(!media)return NextResponse.json({error:"Image not found."},{status:404});
  const payload=await requestData(request);const action=typeof payload.action==="string"?payload.action:"";
  if(action==="remove"){
    const variants=media.variants&&typeof media.variants==="object"&&!Array.isArray(media.variants)?media.variants as Record<string,unknown>:{};const thumbnail=variants.thumbnail&&typeof variants.thumbnail==="object"&&!Array.isArray(variants.thumbnail)?variants.thumbnail as Record<string,unknown>:{};const paths=[media.storage_path,typeof thumbnail.path==="string"?thumbnail.path:null].filter((path):path is string=>Boolean(path));
    const {error:storageError}=await supabase.storage.from("property-media").remove(paths);if(storageError)return NextResponse.json({error:"The image files could not be removed."},{status:500});
    const {error}=await supabase.from("property_media").delete().eq("id",mediaId);if(error)return NextResponse.json({error:"The media record could not be removed."},{status:500});
    if(media.is_cover){const {data:next}=await supabase.from("property_media").select("id").eq("property_id",id).order("sort_order").limit(1).maybeSingle();if(next)await supabase.from("property_media").update({is_cover:true}).eq("id",next.id)}
  }else if(action==="cover"){
    await supabase.from("property_media").update({is_cover:false}).eq("property_id",id).eq("media_type","image");const {error}=await supabase.from("property_media").update({is_cover:true}).eq("id",mediaId);if(error)return NextResponse.json({error:"The cover image could not be changed."},{status:500});
  }else if(action==="up"||action==="down"){
    const direction=action==="up"?-1:1;const query=supabase.from("property_media").select("id,sort_order").eq("property_id",id).eq("media_type","image");const {data:adjacent}=direction<0?await query.lt("sort_order",media.sort_order).order("sort_order",{ascending:false}).limit(1).maybeSingle():await query.gt("sort_order",media.sort_order).order("sort_order").limit(1).maybeSingle();
    if(adjacent){await supabase.from("property_media").update({sort_order:media.sort_order}).eq("id",adjacent.id);await supabase.from("property_media").update({sort_order:adjacent.sort_order}).eq("id",mediaId)}
  }else return NextResponse.json({error:"Invalid media action."},{status:400});
  await supabase.rpc("record_audit_event",{event_action:`media.${action}`,event_type:"property_media",event_reference:property.reference_no,event_new:{media_id:mediaId}});
  return NextResponse.redirect(new URL(`/dashboard/properties/${id}?media=${action}`,request.url),303);
}
