import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {DEV_JV_LABEL,isDevelopmentJv} from "@/src/config/property-catalog";
import {formatArea} from "@/src/lib/area-conversion";
import {formatPrice} from "@/src/lib/format";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import type {AreaUnit,TransactionType} from "@/src/types/property";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Private property preview",robots:{index:false,follow:false}};

export default async function OwnerPreview({params}:{params:Promise<{id:string}>}){
  const{id}=await params;const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect(`/login?returnTo=/dashboard/properties/${id}/preview`);
  const[{data:p},{data:media}]=await Promise.all([supabase.from("properties").select("id,reference_no,title,status,description,transaction_type,price_inr,area_value,area_unit,locality_text,city_text,district_text,details").eq("id",id).eq("owner_id",auth.user.id).is("deleted_at",null).maybeSingle(),supabase.from("property_media").select("id,storage_path,original_filename,sort_order").eq("property_id",id).order("sort_order")]);
  if(!p)notFound();const paths=(media||[]).map(item=>item.storage_path);const{data:signed}=paths.length?await supabase.storage.from("property-media").createSignedUrls(paths,3600):{data:[]};const isDevJv=isDevelopmentJv({transactionType:p.transaction_type,categorySlug:p.details?.category});
  return <main id="main"><section className="inner-hero editorial"><div className="shell"><p className="eyebrow">Private owner preview · {p.reference_no}</p><h1>{p.title}</h1><p>{p.locality_text}, {p.city_text}, {p.district_text}</p><span className={`status status-${p.status}`}>{p.status.replaceAll("_"," ")}</span></div></section><section className="section shell detail-section">{signed?.length?<div className="property-grid preview-gallery">{signed.map((item,index)=><div className="property-image" key={media?.[index]?.id}>{item.signedUrl&&<Image src={item.signedUrl} alt={media?.[index]?.original_filename||p.title} width={640} height={420}/>}</div>)}</div>:<div className="empty-state compact"><p>No images uploaded yet.</p></div>}<div className="detail-title"><div><h2>Listing preview</h2>{isDevJv&&<p>{DEV_JV_LABEL}</p>}<p>{p.description}</p></div><div className="detail-price"><strong>{isDevJv&&"Present Market Price: "}{formatPrice(Number(p.price_inr||0),p.transaction_type as TransactionType)}</strong><span>{formatArea(Number(p.area_value||0),p.area_unit as AreaUnit)}</span></div></div><p className="form-note">This private preview is visible only to you. Public pages remain unavailable until approval and publication.</p><Link className="button" href={`/dashboard/properties/${id}`}>Return to editor</Link></section></main>;
}
