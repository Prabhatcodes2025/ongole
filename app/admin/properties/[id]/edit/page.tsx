import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {AdminNavigation} from "@/src/components/admin-navigation";
import {PropertyPostingFields} from "@/src/components/property-posting-fields";
import {AsyncPropertyForm} from "@/src/components/property-posting-workflow";
import {PERMISSIONS} from "@/src/lib/auth/permissions";
import {getPublicPropertyCatalog} from "@/src/lib/masters/public";
import {propertyEditDefaults} from "@/src/lib/properties/edit-defaults";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Edit property details",robots:{index:false,follow:false}};
const notices:Record<string,string>={updated:"Property details were saved and audited.",uploaded:"Image processed and uploaded.",remove:"Image removed.",cover:"Cover image updated.",up:"Image moved earlier.",down:"Image moved later.",failed:"The image operation failed.",invalid:"Choose valid JPG, PNG or WebP images.",limit:"A property can have up to 6 images."};

export default async function AdminEditPropertyPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{notice?:string;media?:string}>}){
  const{id}=await params,query=await searchParams,supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect(`/login?returnTo=/admin/properties/${id}/edit`);
  const{data:canManage}=await supabase.rpc("has_permission",{required_permission:PERMISSIONS.propertiesManage});
  if(!canManage)redirect("/dashboard");
  const[{data:property},{data:mediaRows},catalog]=await Promise.all([
    supabase.from("properties").select("id,owner_id,reference_no,title,status,transaction_type,description,locality_text,city_text,district_text,state_text,price_inr,area_value,area_unit,details,updated_at,deleted_at,pg_listings(id)").eq("id",id).maybeSingle(),
    supabase.from("property_media").select("id,storage_path,original_filename,processing_status,is_cover,sort_order").eq("property_id",id).order("sort_order"),
    getPublicPropertyCatalog(),
  ]);
  if(!property)notFound();
  if(Array.isArray(property.pg_listings)?property.pg_listings.length>0:Boolean(property.pg_listings))redirect("/admin/pg");
  const media=[...(mediaRows||[])].sort((a,b)=>a.sort_order-b.sort_order),paths=media.map(item=>item.storage_path);
  const{data:signed}=paths.length?await supabase.storage.from("property-media").createSignedUrls(paths,3600):{data:[]};
  const images=media.map((item,index)=>({...item,url:signed?.[index]?.signedUrl||""})),reviewUrl=`/admin/properties/${id}`,notice=notices[query.notice||query.media||""];
  return <main id="main" className="portal-page admin-portal"><div className="shell">
    <nav className="breadcrumbs"><Link href="/admin">Admin</Link><span>›</span><Link href="/admin/properties">Properties</Link><span>›</span><Link href={reviewUrl}>{property.reference_no}</Link><span>›</span><span>Edit</span></nav>
    <div className="portal-title"><div><p className="eyebrow">Administrator edit · {property.reference_no}</p><h1>Edit Property Details</h1><p>Ownership, status, promotions, payments and moderation history are protected from this form.</p></div><Link className="button button-light" href={reviewUrl}>Back to Review</Link></div>
    <AdminNavigation/>{notice&&<p className={`form-message ${["failed","invalid","limit"].includes(query.media||"")?"error":"success"}`} role="status">{notice}</p>}
    {property.deleted_at&&<p className="form-message error" role="alert">This property is soft-deleted. Restore it from the review page before editing.</p>}
    {!property.deleted_at&&<section className="portal-section"><AsyncPropertyForm action={`/api/properties/${id}`} successUrl={`${reviewUrl}?notice=updated`} cancelUrl={reviewUrl}><input type="hidden" name="action" value="update"/><input type="hidden" name="originalUpdatedAt" value={property.updated_at}/><PropertyPostingFields catalog={catalog} defaults={propertyEditDefaults(property)} adminIdentityEdit/><fieldset><legend>9. Admin edit record</legend><label className="wide">Edit reason <span>(optional)</span><textarea name="editReason" rows={3} maxLength={500} placeholder="Why was this correction needed?"/></label><p className="form-note wide">The property keeps its owner, status, publication state and related enquiries. Changed fields are written to the protected audit log.</p></fieldset></AsyncPropertyForm></section>}
    {!property.deleted_at&&<section className="portal-section"><div className="section-heading-row"><h2>Images</h2><span>{images.length}/6</span></div><form className="media-upload" action={`/api/properties/${id}/media?returnTo=admin`} method="post" encType="multipart/form-data"><label>Upload property images<input required multiple type="file" name="image" accept="image/jpeg,image/png,image/webp"/></label><button className="button secondary" type="submit">Process &amp; upload</button><p className="form-note">JPG, PNG or WebP up to 15 MB each. Existing images remain unless explicitly removed.</p></form>{images.length?<ul className="media-manager">{images.map(image=><li key={image.id}>{image.url&&<Image src={image.url} width={150} height={100} alt={image.original_filename}/>}<div><strong>{image.original_filename}</strong><span>{image.is_cover?"Cover image":`Position ${image.sort_order+1}`}</span></div><div className="media-controls">{!image.is_cover&&<form action={`/api/properties/${id}/media/${image.id}?returnTo=admin`} method="post"><button name="action" value="cover">Make cover</button></form>}<form action={`/api/properties/${id}/media/${image.id}?returnTo=admin`} method="post"><button name="action" value="up" aria-label={`Move ${image.original_filename} earlier`}>↑</button><button name="action" value="down" aria-label={`Move ${image.original_filename} later`}>↓</button><button className="danger-link" name="action" value="remove">Remove</button></form></div></li>)}</ul>:<p>No images uploaded.</p>}</section>}
  </div></main>;
}
