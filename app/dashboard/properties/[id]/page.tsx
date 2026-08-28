import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import {CaptchaWidget} from "@/src/components/captcha-widget";
import {PERMISSIONS} from "@/src/lib/auth/permissions";
import {logEvent} from "@/src/lib/observability/logger";
import {resolvePropertyDashboardAccess} from "@/src/lib/properties/dashboard-access";
import {getPublicPropertyCatalog} from "@/src/lib/masters/public";
import {PropertyPostingFields} from "@/src/components/property-posting-fields";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Manage property",robots:{index:false,follow:false}};
const notices:Record<string,string>={created:"Draft created successfully.",updated:"Property details updated.",duplicated:"A new draft copy was created.",uploaded:"Image processed and uploaded.",remove:"Image removed.",cover:"Cover image updated.",up:"Image moved earlier.",down:"Image moved later."};

export default async function ManagePropertyPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{media?:string;notice?:string}>}){
  const {id}=await params;const query=await searchParams;const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect(`/login?returnTo=/dashboard/properties/${id}`);
  const [{data:property,error:propertyError},{data:canReadAll}]=await Promise.all([
    supabase.from("properties").select("id,owner_id,reference_no,title,status,transaction_type,description,locality_text,city_text,district_text,state_text,price_inr,area_value,area_unit,details,slug,submitted_at,updated_at,deleted_at").eq("id",id).is("deleted_at",null).maybeSingle(),
    supabase.rpc("has_permission",{required_permission:PERMISSIONS.propertiesRead}),
  ]);
  if(propertyError){logEvent("error","owner.property_detail_query_failed",{propertyId:id,code:propertyError.code});throw new Error("Property details could not be loaded.")}
  if(!property)notFound();
  const access=resolvePropertyDashboardAccess({authenticatedUserId:auth.user.id,ownerId:property.owner_id,canReadAll:canReadAll===true});
  if(access==="admin")redirect(`/admin/properties/${id}`);if(access==="denied")notFound();
  const [{data:mediaRows,error:mediaError},{data:history,error:historyError},catalog]=await Promise.all([
    supabase.from("property_media").select("id,storage_path,original_filename,processing_status,is_cover,sort_order").eq("property_id",id).order("sort_order"),
    supabase.from("property_status_history").select("id,from_status,to_status,reason,created_at").eq("property_id",id).order("created_at",{ascending:false}),
    getPublicPropertyCatalog(),
  ]);
  if(mediaError)logEvent("error","owner.property_media_query_failed",{propertyId:id,code:mediaError.code});if(historyError)logEvent("error","owner.property_history_query_failed",{propertyId:id,code:historyError.code});
  const editable=["draft","changes_requested"].includes(property.status),media=[...(mediaRows||[])].sort((a,b)=>a.sort_order-b.sort_order),paths=media.map(item=>item.storage_path);
  const {data:signed}=paths.length?await supabase.storage.from("property-media").createSignedUrls(paths,3600):{data:[]};const images=media.map((item,index)=>({...item,url:signed?.[index]?.signedUrl||""}));
  const detail=property.details&&typeof property.details==="object"&&!Array.isArray(property.details)?property.details as Record<string,unknown>:{};const notice=notices[query.notice||query.media||""];
  const formDefaults={transactionType:property.transaction_type,category:detail.category,propertyType:detail.property_type_slug,title:property.title,description:property.description,locality:property.locality_text,city:property.city_text,district:property.district_text,state:property.state_text,price:property.price_inr,rentPeriod:detail.rent_period,areaValue:property.area_value,areaUnit:property.area_unit,propertyAge:detail.property_age,floor:detail.floor,totalFloors:detail.total_floors,bedrooms:detail.bedrooms,bathrooms:detail.bathrooms,facing:detail.facing,cropType:detail.crop_type,soilType:detail.soil_type,amountBasis:detail.amount_basis,fencing:detail.fencing,electricityConnection:detail.electricity_connection,roadAccess:detail.road_access,parking:detail.parking,powerBackup:detail.power_backup,generator:detail.generator,security:detail.security,cctv:detail.cctv,lift:detail.lift,fireSafety:detail.fire_safety,wasteManagement:detail.waste_management,balcony:detail.balcony,poojaRoom:detail.pooja_room,storeRoom:detail.store_room,servantRoom:detail.servant_room,gasPipeline:detail.gas_pipeline,googleMapsUrl:detail.google_maps_url,youtubeUrl:detail.youtube_url};
  return <main id="main" className="portal-page"><div className="shell">
    <nav className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span>›</span><span>{property.reference_no}</span></nav>
    <div className="portal-title"><div><p className="eyebrow">{property.reference_no}</p><h1>{property.title}</h1><p><span className={`status status-${property.status}`}>{property.status.replaceAll("_"," ")}</span> · Updated {new Date(property.updated_at).toLocaleDateString("en-IN")}</p></div><div className="portal-actions"><Link className="button button-light" href={`/dashboard/properties/${id}/preview`}>Preview</Link>{editable&&<form action={`/api/properties/${id}/submit`} method="post"><CaptchaWidget/><button className="button" type="submit">Submit for review</button></form>}</div></div>
    {notice&&<p className="form-message success" role="status">{notice}</p>}
    <div className="review-layout owner-manage"><section className="portal-section"><h2>Property information</h2>
      {editable?<form className="submission-form compact-form" action={`/api/properties/${id}`} method="post"><input type="hidden" name="action" value="update"/><PropertyPostingFields catalog={catalog} defaults={formDefaults} lockIdentity/><button className="button" type="submit">Save changes</button></form>:<dl className="review-facts"><div><dt>Location</dt><dd>{property.locality_text}, {property.city_text}</dd></div><div><dt>Price</dt><dd>₹{Number(property.price_inr||0).toLocaleString("en-IN")}</dd></div><div><dt>Area</dt><dd>{property.area_value} {property.area_unit}</dd></div><div className="wide"><dt>Description</dt><dd>{property.description}</dd></div></dl>}
      <div className="section-heading-row"><h2>Property images</h2><span>{images.length}/20</span></div>
      {editable&&<form className="media-upload" action={`/api/properties/${id}/media`} method="post" encType="multipart/form-data"><label>Upload image<input required type="file" name="image" accept="image/jpeg,image/png,image/webp"/></label><button className="button secondary" type="submit">Process &amp; upload</button><p className="form-note">JPG, PNG or WebP up to 15 MB. Images are resized, converted and watermarked.</p></form>}
      {images.length?<ul className="media-manager">{images.map(image=><li key={image.id}>{image.url&&<Image src={image.url} width={150} height={100} alt={image.original_filename}/>}<div><strong>{image.original_filename}</strong><span>{image.is_cover?"Cover image":`Position ${image.sort_order+1}`}</span></div>{editable&&<div className="media-controls">{!image.is_cover&&<form action={`/api/properties/${id}/media/${image.id}`} method="post"><button name="action" value="cover">Make cover</button></form>}<form action={`/api/properties/${id}/media/${image.id}`} method="post"><button name="action" value="up" aria-label={`Move ${image.original_filename} earlier`}>↑</button><button name="action" value="down" aria-label={`Move ${image.original_filename} later`}>↓</button><button className="danger-link" name="action" value="remove">Remove</button></form></div>}</li>)}</ul>:<div className="empty-state compact"><h3>No images uploaded</h3><p>Add clear images before submitting for review.</p></div>}
    </section><aside className="review-actions"><p className="eyebrow">Lifecycle</p><h2>Approval history</h2>{history?.length?<ol className="timeline">{history.map(item=><li key={item.id}><strong>{item.to_status.replaceAll("_"," ")}</strong><span>{new Date(item.created_at).toLocaleString("en-IN")}</span>{item.reason&&<p>{item.reason}</p>}</li>)}</ol>:<p>No status changes recorded yet.</p>}<hr/><form action={`/api/properties/${id}`} method="post"><button className="button button-light" name="action" value="duplicate">Duplicate property</button></form>{!["pending_review","approved","published"].includes(property.status)&&<form action={`/api/properties/${id}`} method="post"><button className="danger-button" name="action" value="delete">Delete property</button></form>}<Link className="arrow-link" href="/dashboard">Back to dashboard →</Link></aside></div>
  </div></main>;
}
