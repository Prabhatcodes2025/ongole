import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const metadata:Metadata={title:"Preview PG",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function PreviewPg({params}:{params:Promise<{id:string}>}){
  const{id}=await params;const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)redirect(`/login?returnTo=/dashboard/pg/${id}/preview`);
  const{data:pg}=await supabase.from("pg_listings").select("*,pg_room_types(*),properties!inner(id,owner_id,reference_no,description,locality_text,city_text,status,property_media(id,storage_path,original_filename,sort_order))").eq("id",id).eq("properties.owner_id",auth.user.id).maybeSingle();if(!pg)notFound();const property=Array.isArray(pg.properties)?pg.properties[0]:pg.properties;const media=[...(property?.property_media||[])].sort((a,b)=>a.sort_order-b.sort_order);const{data:signed}=media.length?await supabase.storage.from("property-media").createSignedUrls(media.map(item=>item.storage_path),3600):{data:[]};
  return <main id="main" className="detail-page"><div className="shell"><div className="preview-banner">Owner preview · <Link href={`/dashboard/pg/${id}`}>Back to editor</Link></div><p className="eyebrow">{property?.reference_no} · {property?.status}</p><h1>{pg.pg_name}</h1>{signed?.length?<div className="property-grid preview-gallery">{signed.map((item,index)=><div className="property-image" key={media[index]?.id}>{item.signedUrl&&<Image src={item.signedUrl} alt={media[index]?.original_filename||pg.pg_name} width={640} height={420}/>}</div>)}</div>:<div className="empty-state compact"><p>No images uploaded yet.</p></div>}<p>{pg.address_line}, {property?.locality_text}, {property?.city_text}</p><p>{property?.description}</p><h2>Rooms</h2><div className="feature-grid">{pg.pg_room_types?.map((room:{id:string;name:string;sharing_type:string;available_beds:number;monthly_rent:number})=><article key={room.id}><h3>{room.name}</h3><p>{room.sharing_type.replaceAll("_"," ")} · {room.available_beds} beds available</p><strong>₹{Number(room.monthly_rent).toLocaleString("en-IN")}/month</strong></article>)}</div><h2>Amenities</h2><p>{pg.amenities?.join(" · ")||"No amenities selected"}</p></div></main>;
}
