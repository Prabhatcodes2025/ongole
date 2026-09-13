import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {ChartNoAxesCombined,Eye,MessageSquare,MousePointerClick} from "lucide-react";
import {ChartCard,DashboardShell,DataTable,EmptyState,StatCard} from "@/src/components/dashboard/dashboard-shell";
import {getDashboardAuth} from "@/src/lib/dashboard/context";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Listing analytics",robots:{index:false,follow:false}};
type EnquirySummary={total?:number;locations?:Array<{location?:string;count?:number}>};

export default async function OwnerAnalytics({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
  const params=await searchParams;const{supabase,user}=await getDashboardAuth();if(!user)redirect("/login?returnTo=/dashboard/analytics");
  const end=params.to&&/^\d{4}-\d{2}-\d{2}$/.test(params.to)?params.to:new Date().toISOString().slice(0,10);const defaultStart=new Date();defaultStart.setDate(defaultStart.getDate()-29);const start=params.from&&/^\d{4}-\d{2}-\d{2}$/.test(params.from)?params.from:defaultStart.toISOString().slice(0,10);
  const[{data:paid},{data:admin},{data:rows},{data:properties},{data:summaryData}]=await Promise.all([
    supabase.rpc("has_my_paid_enquiry_access"),
    supabase.rpc("has_permission",{required_permission:"analytics.read"}),
    supabase.from("analytics_daily").select("day,entity_id,event_type,event_count").eq("owner_id",user.id).gte("day",start).lte("day",end),
    supabase.from("properties").select("id,title,reference_no").eq("owner_id",user.id),
    supabase.rpc("get_my_enquiry_summary"),
  ]);
  const detailed=paid===true||admin===true,summary=summaryData as EnquirySummary|null,locations=Array.isArray(summary?.locations)?summary.locations:[],all=rows||[];
  const total=(event:string)=>all.filter((row)=>row.event_type===event).reduce((sum,row)=>sum+Number(row.event_count),0);
  const days=Array.from({length:Math.min(31,Math.max(1,Math.ceil((Date.parse(end)-Date.parse(start))/86400000)+1))},(_,index)=>{const day=new Date(`${start}T00:00:00Z`);day.setUTCDate(day.getUTCDate()+index);return day.toISOString().slice(0,10)});
  const views=days.map((day)=>all.filter((row)=>row.day===day&&row.event_type==="listing_view").reduce((sum,row)=>sum+Number(row.event_count),0)),max=Math.max(1,...views);
  const title=new Map((properties||[]).map((item)=>[item.id,item]));
  const performance=[...new Set(all.map((row)=>row.entity_id).filter(Boolean))].map((id)=>({id:id!,views:all.filter((row)=>row.entity_id===id&&row.event_type==="listing_view").reduce((sum,row)=>sum+Number(row.event_count),0),enquiries:all.filter((row)=>row.entity_id===id&&row.event_type==="enquiry_submitted").reduce((sum,row)=>sum+Number(row.event_count),0),contacts:all.filter((row)=>row.entity_id===id&&["phone_click","whatsapp_click"].includes(row.event_type)).reduce((sum,row)=>sum+Number(row.event_count),0)})).sort((a,b)=>b.views-a.views);
  return <DashboardShell title="Listing analytics" description={`${start} to ${end}. Privacy-safe first-party performance.`} actions={detailed?<><a className="button button-light" href={`/api/dashboard/reports/analytics?format=csv&from=${start}&to=${end}`}>CSV</a><a className="button button-light" href={`/api/dashboard/reports/analytics?format=xlsx&from=${start}&to=${end}`}>Excel</a></>:<Link className="button" href="/dashboard/billing">See membership options</Link>} breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"Analytics"}]}><form className="filter-bar"><label>From <input name="from" type="date" defaultValue={start}/></label><label>To <input name="to" type="date" defaultValue={end}/></label><button className="button button-small">Apply</button></form><section className="dashboard-stat-grid"><StatCard label="Listing views" value={total("listing_view")} icon={<Eye/>}/><StatCard label="Enquiries" value={Number(summary?.total||0)} icon={<MessageSquare/>}/><StatCard label="Phone clicks" value={total("phone_click")} icon={<MousePointerClick/>}/><StatCard label="WhatsApp clicks" value={total("whatsapp_click")} icon={<ChartNoAxesCombined/>}/></section><section className="dashboard-section"><ChartCard title="Views over time"><div className="chart-bars">{days.map((day,index)=><div key={day}><i style={{height:`${Math.max(3,views[index]/max*100)}%`}}/><small>{day.slice(8)}</small></div>)}</div></ChartCard></section><section className="dashboard-card dashboard-section"><h2>Enquiries by location</h2>{locations.length?<DataTable caption="Enquiries by listing location" headers={["Location","Enquiries"]}>{locations.map((item,index)=><tr key={`${item.location||"location"}-${index}`}><td>{item.location||"Location not specified"}</td><td>{Number(item.count||0)}</td></tr>)}</DataTable>:<p>No enquiries yet.</p>}</section>{detailed&&<section className="dashboard-section">{performance.length?<DataTable caption="Listing performance" headers={["Listing","Views","Enquiries","Contact clicks","Conversion"]}>{performance.map((item)=><tr key={item.id}><td><strong>{title.get(item.id)?.title||"Listing"}</strong><br/><small>{title.get(item.id)?.reference_no}</small></td><td>{item.views}</td><td>{item.enquiries}</td><td>{item.contacts}</td><td>{item.views?`${(item.enquiries/item.views*100).toFixed(1)}%`:"0%"}</td></tr>)}</DataTable>:<EmptyState title="No analytics yet" description="Published listing engagement will appear after daily aggregation."/>}</section>}</DashboardShell>;
}
