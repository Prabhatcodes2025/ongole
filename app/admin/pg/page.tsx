import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {AdminNavigation} from "@/src/components/admin-navigation";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"PG administration",robots:{index:false,follow:false}};
const statuses=["","draft","pending_review","changes_requested","approved","published","rejected","archived"];

export default async function AdminPgPage({searchParams}:{searchParams:Promise<{status?:string;q?:string;page?:string}>}){
  const params=await searchParams;const page=Math.max(1,Number(params.page)||1),pageSize=20;
  const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?returnTo=/admin/pg");
  const {data:allowed}=await supabase.rpc("has_permission",{required_permission:"pg.read"});if(!allowed)redirect("/dashboard");
  let query=supabase.from("pg_listings").select("id,pg_name,category,rent_per_bed,property_id,properties!inner(reference_no,status,locality_text,city_text,updated_at,is_featured,is_verified,is_pinned,deleted_at)",{count:"exact"}).order("updated_at",{referencedTable:"properties",ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  if(statuses.includes(params.status||"")&&params.status)query=query.eq("properties.status",params.status);
  if(params.q)query=query.ilike("pg_name",`%${params.q.replace(/[%(),]/g,"")}%`);
  const {data:listings,count,error}=await query;
  const pages=Math.max(1,Math.ceil((count||0)/pageSize));
  return <main id="main" className="portal-page admin-portal"><div className="shell"><div className="portal-title"><div><p className="eyebrow">PG operations</p><h1>Paying guest listings</h1><p>Review lifecycle submissions and moderate PG visibility.</p></div></div><AdminNavigation/><form className="admin-filters"><input name="q" defaultValue={params.q} placeholder="PG name"/><select name="status" defaultValue={params.status||""}>{statuses.map((status)=><option key={status||"all"} value={status}>{status?status.replaceAll("_"," "):"All statuses"}</option>)}</select><button className="button button-small">Search</button></form><section className="portal-section admin-table-wrap">{error?<div className="config-warning">PG listings could not be loaded.</div>:listings?.length?<div className="admin-table property-admin-table"><div className="admin-row admin-head"><span>PG</span><span>Type</span><span>Location</span><span>Status</span><span>Flags</span><span/></div>{listings.map((pg)=>{const property=Array.isArray(pg.properties)?pg.properties[0]:pg.properties;return <div className="admin-row" key={pg.id}><span><strong>{pg.pg_name}</strong><small>{property?.reference_no}</small></span><span>{pg.category.replaceAll("_"," ")}</span><span>{property?.locality_text}, {property?.city_text}</span><span><i className={`status status-${property?.status}`}>{property?.status?.replaceAll("_"," ")}</i></span><span className="flag-list">{property?.is_verified&&<b>Verified</b>}{property?.is_featured&&<b>Featured</b>}{property?.is_pinned&&<b>Pinned</b>}{property?.deleted_at&&<b>Deleted</b>}</span><span><Link href={`/admin/pg/${pg.id}`}>Review →</Link></span></div>})}</div>:<div className="empty-state"><h2>No matching PG listings</h2></div>}</section><nav className="pagination">{page>1&&<Link href={`/admin/pg?page=${page-1}`}>Previous</Link>}<span>Page {page} of {pages}</span>{page<pages&&<Link href={`/admin/pg?page=${page+1}`}>Next</Link>}</nav></div></main>;
}
