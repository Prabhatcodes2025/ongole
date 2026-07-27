import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"My PG listings",robots:{index:false,follow:false}};
const statuses=["","draft","pending_review","changes_requested","approved","published","rejected","archived"];

export default async function PgDashboard({searchParams}:{searchParams:Promise<{status?:string;notice?:string}>}){
  const params=await searchParams;
  const status=statuses.includes(params.status||"")?params.status||"":"";
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?returnTo=/dashboard/pg");
  let query=supabase.from("pg_listings").select("id,pg_name,category,rent_per_bed,capacity,property_id,properties!inner(reference_no,status,locality_text,city_text,updated_at,deleted_at)").eq("properties.owner_id",auth.user.id).is("properties.deleted_at",null).order("updated_at",{referencedTable:"properties",ascending:false});
  if(status)query=query.eq("properties.status",status);
  const {data:listings,error}=await query;
  return <main id="main" className="portal-page"><div className="shell">
    <nav className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span>›</span><span>Paying guest</span></nav>
    <div className="portal-title"><div><p className="eyebrow">PG owner dashboard</p><h1>Your PG listings</h1><p>Create, manage and submit paying guest accommodation for review.</p></div><Link className="button" href="/dashboard/pg/new">Create PG listing</Link></div>
    {params.notice==="deleted"&&<p className="form-message success">The PG listing was soft deleted.</p>}
    <nav className="status-tabs" aria-label="Filter PG listings">{statuses.map((item)=><Link className={status===item?"is-active":""} key={item||"all"} href={item?`/dashboard/pg?status=${item}`:"/dashboard/pg"}>{item?item.replaceAll("_"," "):"All"}</Link>)}</nav>
    <section className="portal-section">{error?<div className="config-warning"><h2>PG listings could not be loaded</h2><p>{error.message}</p></div>:listings?.length?<div className="portal-list">{listings.map((pg)=>{const property=Array.isArray(pg.properties)?pg.properties[0]:pg.properties;return <article key={pg.id}><div><span className={`status status-${property?.status}`}>{property?.status?.replaceAll("_"," ")}</span><h2>{pg.pg_name}</h2><p>{property?.reference_no} · {pg.category.replaceAll("_"," ")} · {property?.locality_text}, {property?.city_text} · ₹{Number(pg.rent_per_bed).toLocaleString("en-IN")}/bed</p></div><Link href={`/dashboard/pg/${pg.id}`}>Manage →</Link></article>})}</div>:<div className="empty-state"><h2>No PG listings found</h2><p>Create your first listing and add its room inventory.</p><Link className="button" href="/dashboard/pg/new">Create PG listing</Link></div>}</section>
  </div></main>;
}
