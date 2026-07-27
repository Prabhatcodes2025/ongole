import type {Metadata} from "next";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const metadata:Metadata={title:"Preview PG",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function PreviewPg({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect(`/login?returnTo=/dashboard/pg/${id}/preview`);
  const {data:pg}=await supabase.from("pg_listings").select("*,pg_room_types(*),properties!inner(owner_id,reference_no,description,locality_text,city_text,status)").eq("id",id).eq("properties.owner_id",auth.user.id).maybeSingle();
  if(!pg)notFound();const property=Array.isArray(pg.properties)?pg.properties[0]:pg.properties;
  return <main id="main" className="detail-page"><div className="shell"><div className="preview-banner">Owner preview · <Link href={`/dashboard/pg/${id}`}>Back to editor</Link></div><p className="eyebrow">{property?.reference_no} · {property?.status}</p><h1>{pg.pg_name}</h1><p>{pg.address_line}, {property?.locality_text}, {property?.city_text}</p><p>{property?.description}</p><h2>Rooms</h2><div className="feature-grid">{pg.pg_room_types?.map((room:{id:string;name:string;sharing_type:string;available_beds:number;monthly_rent:number})=><article key={room.id}><h3>{room.name}</h3><p>{room.sharing_type.replaceAll("_"," ")} · {room.available_beds} beds available</p><strong>₹{Number(room.monthly_rent).toLocaleString("en-IN")}/month</strong></article>)}</div><h2>Amenities</h2><p>{pg.amenities?.join(" · ")||"No amenities selected"}</p></div></main>;
}
