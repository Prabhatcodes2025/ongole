import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {DashboardShell,DataTable,EmptyState,FilterBar,StatusBadge} from "@/src/components/dashboard/dashboard-shell";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
export const dynamic="force-dynamic";export const metadata:Metadata={title:"My properties",robots:{index:false,follow:false}};
const statuses=["","draft","pending_review","changes_requested","approved","published","rejected","archived"];
export default async function OwnerProperties({searchParams}:{searchParams:Promise<{status?:string;q?:string}>}){
  const params=await searchParams;const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)redirect("/login?returnTo=/dashboard/properties");
  let query=supabase.from("properties").select("id,reference_no,title,status,locality_text,city_text,price_inr,updated_at,details").eq("owner_id",auth.user.id).is("deleted_at",null).order("updated_at",{ascending:false});
  if(params.status&&statuses.includes(params.status))query=query.eq("status",params.status);if(params.q)query=query.ilike("title",`%${params.q.replace(/[%(),]/g,"")}%`);
  const{data:allProperties}=await query;const properties=(allProperties||[]).filter((item)=>item.details?.listing_kind!=="paying_guest");
  return <DashboardShell title="Properties" description="Manage property drafts, reviews and published listings." actions={<Link className="button" href="/post-property">Post property</Link>} breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"Properties"}]}><FilterBar><form><input name="q" defaultValue={params.q} placeholder="Search properties"/><select name="status" defaultValue={params.status||""}>{statuses.map((status)=><option key={status||"all"} value={status}>{status?status.replaceAll("_"," "):"All statuses"}</option>)}</select><button className="button button-small">Filter</button></form></FilterBar>{properties?.length?<DataTable caption="Owner properties" headers={["Property","Location","Price","Status","Updated",""]}>{properties.map((item)=><tr key={item.id}><td><strong>{item.title}</strong><br/><small>{item.reference_no}</small></td><td>{item.locality_text}, {item.city_text}</td><td>₹{Number(item.price_inr||0).toLocaleString("en-IN")}</td><td><StatusBadge status={item.status}/></td><td>{new Date(item.updated_at).toLocaleDateString("en-IN")}</td><td><Link href={`/dashboard/properties/${item.id}`}>Manage</Link></td></tr>)}</DataTable>:<EmptyState title="No properties found" description="Create a listing or change the current filters." action={<Link className="button" href="/post-property">Post property</Link>}/>}</DashboardShell>;
}
