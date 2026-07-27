import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {PgForm} from "@/app/dashboard/pg/new/page";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Manage PG listing",robots:{index:false,follow:false}};
const notices:Record<string,string>={created:"PG draft created.",updated:"PG details saved.",duplicated:"PG draft duplicated.",submitted:"PG submitted for review.","room-added":"Room type added.","room-removed":"Room type removed.",uploaded:"Image uploaded.",remove:"Image removed.",cover:"Cover image updated.",up:"Image moved earlier.",down:"Image moved later."};

export default async function ManagePgPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{notice?:string;media?:string}>}){
  const {id}=await params;const query=await searchParams;
  const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect(`/login?returnTo=/dashboard/pg/${id}`);
  const {data:pg}=await supabase.from("pg_listings").select("*,properties!inner(id,owner_id,reference_no,title,description,status,locality_text,city_text,district_text,state_text,latitude,longitude,slug,updated_at,deleted_at,property_media(id,storage_path,original_filename,is_cover,sort_order))").eq("id",id).eq("properties.owner_id",auth.user.id).is("properties.deleted_at",null).maybeSingle();
  if(!pg)notFound();
  const property=Array.isArray(pg.properties)?pg.properties[0]:pg.properties;
  if(!property)notFound();
  const [{data:rooms},{data:history}]=await Promise.all([
    supabase.from("pg_room_types").select("*").eq("pg_listing_id",id).order("sort_order"),
    supabase.from("property_status_history").select("id,to_status,reason,created_at").eq("property_id",pg.property_id).order("created_at",{ascending:false})
  ]);
  const media=[...(property.property_media||[])].sort((a,b)=>a.sort_order-b.sort_order);
  const {data:signed}=media.length?await supabase.storage.from("property-media").createSignedUrls(media.map((item)=>item.storage_path),3600):{data:[]};
  const editable=["draft","changes_requested"].includes(property.status);
  const defaults={...pg,id,description:property.description,locality:property.locality_text,city:property.city_text,district:property.district_text,state:property.state_text,latitude:property.latitude,longitude:property.longitude};
  const notice=notices[query.notice||query.media||""];
  return <main id="main" className="portal-page"><div className="shell">
    <nav className="breadcrumbs"><Link href="/dashboard/pg">PG dashboard</Link><span>›</span><span>{property.reference_no}</span></nav>
    <div className="portal-title"><div><p className="eyebrow">{property.reference_no}</p><h1>{pg.pg_name}</h1><p><span className={`status status-${property.status}`}>{property.status.replaceAll("_"," ")}</span> · Updated {new Date(property.updated_at).toLocaleDateString("en-IN")}</p></div><div className="portal-actions"><Link className="button button-light" href={`/dashboard/pg/${id}/preview`}>Preview</Link>{editable&&<form action={`/api/pg/${id}/submit`} method="post"><button className="button">Submit for review</button></form>}</div></div>
    {notice&&<p className="form-message success">{notice}</p>}
    <div className="review-layout owner-manage"><div>
      <section className="portal-section"><h2>PG information</h2>{editable?<PgForm defaults={defaults}/>:<dl className="review-facts"><div><dt>Category</dt><dd>{pg.category.replaceAll("_"," ")}</dd></div><div><dt>Location</dt><dd>{property.locality_text}, {property.city_text}</dd></div><div><dt>Rent from</dt><dd>₹{Number(pg.rent_per_bed).toLocaleString("en-IN")}</dd></div><div className="wide"><dt>Description</dt><dd>{property.description}</dd></div></dl>}</section>
      <section className="portal-section"><div className="section-heading-row"><h2>Room types</h2><span>{rooms?.length||0}</span></div>
        {rooms?.length?<div className="admin-table"><div className="admin-row admin-head"><span>Room</span><span>Sharing</span><span>Beds</span><span>Rent</span><span/></div>{rooms.map((room)=><div className="admin-row" key={room.id}><span><strong>{room.name}</strong></span><span>{room.sharing_type.replaceAll("_"," ")}</span><span>{room.available_beds}/{room.capacity}</span><span>₹{Number(room.monthly_rent).toLocaleString("en-IN")}</span><span>{editable&&<form action={`/api/pg/${id}/rooms/${room.id}`} method="post"><button className="danger-link" name="action" value="delete">Remove</button></form>}</span></div>)}</div>:<div className="empty-state compact"><p>No room types added.</p></div>}
        {editable&&<form className="submission-form compact-form room-form" action={`/api/pg/${id}/rooms`} method="post"><label>Room name<input required name="name" placeholder="Double sharing room"/></label><label>Sharing<select name="sharing_type"><option value="single">Single</option><option value="double">Double</option><option value="triple">Triple</option><option value="four_sharing">Four sharing</option></select></label><label>Capacity<input required name="capacity" type="number" min="1"/></label><label>Available beds<input required name="available_beds" type="number" min="0"/></label><label>Monthly rent<input required name="monthly_rent" type="number" min="0"/></label><label>Deposit<input name="security_deposit" type="number" min="0"/></label><button className="button secondary">Add room</button></form>}
      </section>
      <section className="portal-section"><div className="section-heading-row"><h2>Images</h2><span>{media.length}/20</span></div>
        {editable&&<form className="media-upload" action={`/api/properties/${pg.property_id}/media?context=pg&pgId=${id}`} method="post" encType="multipart/form-data"><label>Upload image<input required type="file" name="image" accept="image/jpeg,image/png,image/webp"/></label><button className="button secondary">Process &amp; upload</button></form>}
        {media.length?<ul className="media-manager">{media.map((image,index)=><li key={image.id}>{signed?.[index]?.signedUrl&&<Image src={signed[index].signedUrl} width={150} height={100} alt={image.original_filename}/>}<div><strong>{image.original_filename}</strong><span>{image.is_cover?"Cover image":`Position ${image.sort_order+1}`}</span></div>{editable&&<div className="media-controls"><form action={`/api/properties/${pg.property_id}/media/${image.id}?context=pg&pgId=${id}`} method="post">{!image.is_cover&&<button name="action" value="cover">Make cover</button>}<button name="action" value="up">↑</button><button name="action" value="down">↓</button><button className="danger-link" name="action" value="remove">Remove</button></form></div>}</li>)}</ul>:<div className="empty-state compact"><p>No images uploaded.</p></div>}
      </section>
    </div><aside className="review-actions"><p className="eyebrow">Lifecycle</p><h2>Approval history</h2>{history?.length?<ol className="timeline">{history.map((item)=><li key={item.id}><strong>{item.to_status.replaceAll("_"," ")}</strong><span>{new Date(item.created_at).toLocaleString("en-IN")}</span>{item.reason&&<p>{item.reason}</p>}</li>)}</ol>:<p>No status changes yet.</p>}<hr/><form action={`/api/pg/${id}`} method="post"><button className="button button-light" name="action" value="duplicate">Duplicate PG</button></form>{!["pending_review","approved","published"].includes(property.status)&&<form action={`/api/pg/${id}`} method="post"><button className="danger-button" name="action" value="delete">Delete PG</button></form>}</aside></div>
  </div></main>;
}
