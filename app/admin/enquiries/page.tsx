import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNavigation } from "@/src/components/admin-navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Enquiry CRM",robots:{index:false,follow:false}};
const statuses=["new","assigned","contacted","follow_up","qualified","closed","lost","spam"];
function one<T>(value:T|T[]|null):T|undefined{return Array.isArray(value)?value[0]:value||undefined}

export default async function EnquiriesPage({searchParams}:{searchParams:Promise<{status?:string;priority?:string;q?:string;page?:string}>}){
  const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();if(!auth.user)redirect("/login?returnTo=/admin/enquiries");
  const {data:allowed}=await supabase.rpc("has_permission",{required_permission:"enquiries.read"});if(!allowed)redirect("/admin");
  const params=await searchParams;const page=Math.max(1,Number(params.page)||1),size=20;
  let query=supabase.from("enquiries").select("id,reference_no,property_id,name,mobile,email,status,priority,assigned_to,follow_up_at,created_at,properties(title,reference_no)",{count:"exact"}).order("created_at",{ascending:false}).range((page-1)*size,page*size-1);
  if(statuses.includes(params.status||""))query=query.eq("status",params.status);if(["low","normal","high","urgent"].includes(params.priority||""))query=query.eq("priority",params.priority);if(params.q)query=query.or(`name.ilike.%${params.q.replace(/[%(),]/g,"")}%,mobile.ilike.%${params.q.replace(/[%(),]/g,"")}%,reference_no.ilike.%${params.q.replace(/[%(),]/g,"")}%`);
  const {data,count}=await query;const pages=Math.max(1,Math.ceil((count||0)/size));
  return <main id="main" className="portal-page admin-portal"><div className="shell"><div className="portal-title"><div><p className="eyebrow">Lead operations</p><h1>Enquiry CRM</h1><p>Assign, prioritise and follow every property enquiry.</p></div></div><AdminNavigation/><form className="admin-filters"><input name="q" defaultValue={params.q} placeholder="Reference, name or mobile"/><select name="status" defaultValue={params.status||""}><option value="">All statuses</option>{statuses.map((status)=><option key={status}>{status}</option>)}</select><select name="priority" defaultValue={params.priority||""}><option value="">All priorities</option>{["low","normal","high","urgent"].map((priority)=><option key={priority}>{priority}</option>)}</select><button className="button button-small">Search</button></form><section className="portal-section admin-table-wrap">{data?.length?<div className="admin-table crm-table"><div className="admin-row admin-head"><span>Lead</span><span>Property</span><span>Status</span><span>Priority</span><span>Follow-up</span><span/></div>{data.map((item)=>{const property=one(item.properties);return <div className="admin-row" key={item.id}><span><strong>{item.name}</strong><small>{item.reference_no} · {item.mobile}</small></span><span>{property?.title||"General enquiry"}<small>{property?.reference_no}</small></span><span><i className={`status status-${item.status}`}>{item.status.replaceAll("_"," ")}</i></span><span>{item.priority}</span><span>{item.follow_up_at?new Date(item.follow_up_at).toLocaleString("en-IN"):"—"}</span><span><Link href={`/admin/enquiries/${item.id}`}>Open →</Link></span></div>})}</div>:<div className="empty-state"><h2>No matching enquiries</h2></div>}</section><nav className="pagination">{page>1&&<Link href={`/admin/enquiries?page=${page-1}`}>Previous</Link>}<span>Page {page} of {pages}</span>{page<pages&&<Link href={`/admin/enquiries?page=${page+1}`}>Next</Link>}</nav></div></main>;
}
