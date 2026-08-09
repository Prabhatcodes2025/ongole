import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {BarChart3,Building2,CirclePlus,ClipboardList,Eye,Home,MessageSquare,MousePointerClick,Send} from "lucide-react";
import {ActivityTimeline,ChartCard,DashboardShell,DataTable,EmptyState,PlanUsageCard,QuickActionCard,StatCard,StatusBadge} from "@/src/components/dashboard/dashboard-shell";
import {env} from "@/src/lib/env";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Owner dashboard",robots:{index:false,follow:false}};
type PropertyRow={id:string;reference_no:string;title:string;status:string;updated_at:string;locality_text:string;details:Record<string,unknown>|null};
type DailyRow={day:string;event_type:string;event_count:number;entity_id:string|null};

export default async function DashboardPage(){
  if(!env.isSupabaseConfigured)return <main id="main" className="portal-page"><div className="shell"><div className="config-warning"><h1>Dashboard configuration pending</h1><p>Add Supabase environment values and apply migrations.</p></div></div></main>;
  const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();if(!auth.user)redirect("/login?returnTo=/dashboard");
  const start=new Date();start.setDate(start.getDate()-29);start.setHours(0,0,0,0);
  const {data:properties}=await supabase.from("properties").select("id,reference_no,title,status,updated_at,locality_text,details").eq("owner_id",auth.user.id).is("deleted_at",null).order("updated_at",{ascending:false});
  const propertyRows=(properties||[]) as PropertyRow[];const ids=propertyRows.map((item)=>item.id);
  const [{data:planContext},{data:enquiries},{data:analytics},{data:history}]=await Promise.all([
    supabase.rpc("get_my_plan_context"),
    ids.length?supabase.from("enquiries").select("id,status,created_at,property_id").in("property_id",ids):Promise.resolve({data:[]}),
    supabase.from("analytics_daily").select("day,event_type,event_count,entity_id").eq("owner_id",auth.user.id).gte("day",start.toISOString().slice(0,10)),
    ids.length?supabase.from("property_status_history").select("id,to_status,reason,created_at,property_id").in("property_id",ids).order("created_at",{ascending:false}).limit(8):Promise.resolve({data:[]})
  ]);
  const regular=propertyRows.filter((item)=>item.details?.listing_kind!=="paying_guest");const pgs=propertyRows.filter((item)=>item.details?.listing_kind==="paying_guest");
  const daily=(analytics||[]) as DailyRow[];const total=(event:string)=>daily.filter((row)=>row.event_type===event).reduce((sum,row)=>sum+Number(row.event_count),0);
  const plan=(planContext as {plan?:{name?:string;listing_limit?:number};usage?:{properties?:number}}|null)||{};
  const days=Array.from({length:14},(_,index)=>{const date=new Date();date.setDate(date.getDate()-(13-index));return date.toISOString().slice(0,10)});
  const views=days.map((day)=>daily.filter((row)=>row.day===day&&row.event_type==="listing_view").reduce((sum,row)=>sum+Number(row.event_count),0));const maxViews=Math.max(1,...views);
  const titleById=new Map(propertyRows.map((item)=>[item.id,item.title]));const activity=(history||[]).map((item)=>({id:item.id,title:`${titleById.get(item.property_id)||"Listing"}: ${item.to_status.replaceAll("_"," ")}`,detail:item.reason||undefined,createdAt:item.created_at}));
  return <DashboardShell title="Overview" description="Your listings, enquiries, audience and plan usage in one place." actions={<><Link className="button button-light" href="/dashboard/pg/new">Add PG</Link><Link className="button" href="/post-property">Post property</Link></>}>
    <section className="dashboard-stat-grid">
      <StatCard label="Total listings" value={propertyRows.length} icon={<ClipboardList/>}/><StatCard label="Draft listings" value={propertyRows.filter((item)=>item.status==="draft").length} icon={<Home/>}/><StatCard label="Pending review" value={propertyRows.filter((item)=>item.status==="pending_review").length} icon={<Send/>}/><StatCard label="Approved" value={propertyRows.filter((item)=>item.status==="approved").length} icon={<Eye/>}/><StatCard label="Published" value={propertyRows.filter((item)=>item.status==="published").length} icon={<Eye/>}/><StatCard label="Archived" value={propertyRows.filter((item)=>item.status==="archived").length} icon={<ClipboardList/>}/>
      <StatCard label="Needs attention" value={propertyRows.filter((item)=>["rejected","changes_requested"].includes(item.status)).length} icon={<CirclePlus/>}/><StatCard label="Total enquiries" value={enquiries?.length||0} icon={<MessageSquare/>}/><StatCard label="New enquiries" value={enquiries?.filter((item)=>item.status==="new").length||0} icon={<MessageSquare/>}/><StatCard label="Listing views (30d)" value={total("listing_view")} icon={<BarChart3/>}/>
      <StatCard label="Contact clicks" value={total("phone_click")} icon={<MousePointerClick/>}/><StatCard label="WhatsApp clicks" value={total("whatsapp_click")} icon={<MousePointerClick/>}/><StatCard label="Properties" value={regular.length} icon={<Home/>}/><StatCard label="PG listings" value={pgs.length} icon={<Building2/>}/>
    </section>
    <section className="dashboard-grid-main"><ChartCard title="Listing views" description="First-party views over the last 14 days"><div className="chart-bars">{days.map((day,index)=><div key={day}><i style={{height:`${Math.max(3,views[index]/maxViews*100)}%`}}/><small>{day.slice(8)}</small></div>)}</div></ChartCard><PlanUsageCard plan={plan.plan?.name||"Free"} used={plan.usage?.properties||regular.length} limit={plan.plan?.listing_limit||1} label="Property listings"/></section>
    <section className="dashboard-grid-2"><article className="dashboard-card"><header><h2>Quick actions</h2></header><div className="quick-action-grid"><QuickActionCard href="/post-property" title="Post Property" description="Create a new property draft" icon={<Home/>}/><QuickActionCard href="/dashboard/pg/new" title="Add PG" description="Create paying guest accommodation" icon={<Building2/>}/><QuickActionCard href="/dashboard/enquiries" title="View Enquiries" description="Respond to interested customers" icon={<MessageSquare/>}/><QuickActionCard href="/dashboard/billing" title="Upgrade Plan" description="Compare listing and analytics limits" icon={<BarChart3/>}/><QuickActionCard href="/dashboard/profile" title="Edit Profile" description="Update account and contact details" icon={<CirclePlus/>}/></div></article><article className="dashboard-card"><header><h2>Recent activity</h2></header><ActivityTimeline items={activity}/></article></section>
    <section className="dashboard-section"><div className="dashboard-section-head"><h2>Recent listings</h2><Link href="/dashboard/properties">View all</Link></div>{propertyRows.length?<DataTable caption="Recent owner listings" headers={["Listing","Type","Location","Status","Updated",""]}>{propertyRows.slice(0,8).map((item)=><tr key={item.id}><td><strong>{item.title}</strong><br/><small>{item.reference_no}</small></td><td>{item.details?.listing_kind==="paying_guest"?"PG":"Property"}</td><td>{item.locality_text}</td><td><StatusBadge status={item.status}/></td><td>{new Date(item.updated_at).toLocaleDateString("en-IN")}</td><td><Link href={item.details?.listing_kind==="paying_guest"?`/dashboard/pg`:`/dashboard/properties/${item.id}`}>Manage</Link></td></tr>)}</DataTable>:<EmptyState title="No listings yet" description="Create your first property or PG listing." action={<Link className="button" href="/post-property">Post property</Link>}/>}</section>
  </DashboardShell>;
}
