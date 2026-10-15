import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {ChartCard,DashboardShell,DataTable,EmptyState,StatCard} from "@/src/components/dashboard/dashboard-shell";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Platform analytics",robots:{index:false,follow:false}};

type VisitorDay={day:string;visits:number;visitors:number};
type VisitorLocation={country:string;region:string;city:string;visits:number;visitors:number};
type VisitorAnalytics={total_visits:number;total_visitors:number;by_day:VisitorDay[];by_location:VisitorLocation[]};
type Breakdown={name:string;count:number};type LaunchAnalytics={by_service:Breakdown[];by_source:Breakdown[];landing_pages:{name:string;count:number;visitors:number}[];properties:{reference:string;views:number;visitors:number;whatsapp:number;phone:number;map_clicks:number;enquiries:number}[]};
const emptyVisitors:VisitorAnalytics={total_visits:0,total_visitors:0,by_day:[],by_location:[]};
const emptyLaunch:LaunchAnalytics={by_service:[],by_source:[],landing_pages:[],properties:[]};
const isoDate=(value:string|undefined,fallback:string)=>value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:fallback;

export default async function AdminAnalytics({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
  const params=await searchParams,supabase=await createSupabaseServerClient();
  const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?returnTo=/admin/analytics");
  const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"analytics.read"});
  if(!allowed)redirect("/admin");

  const today=new Date(),monthStart=new Date();monthStart.setDate(monthStart.getDate()-29);
  const defaultTo=today.toISOString().slice(0,10),defaultFrom=monthStart.toISOString().slice(0,10);
  const to=isoDate(params.to,defaultTo),from=isoDate(params.from,defaultFrom);
  const[{data:rows},{data:visitorResult,error:visitorError},{data:launchResult}]=await Promise.all([
    supabase.from("analytics_daily").select("day,entity_type,event_type,event_count").gte("day",from).lte("day",to),
    supabase.rpc("get_visitor_analytics",{date_from:from,date_to:to}),
    supabase.rpc("get_launch_analytics",{date_from:from,date_to:to}),
  ]);
  const visitors=!visitorError&&visitorResult&&typeof visitorResult==="object"&&!Array.isArray(visitorResult)?visitorResult as unknown as VisitorAnalytics:emptyVisitors;
  const launch=launchResult&&typeof launchResult==="object"&&!Array.isArray(launchResult)?launchResult as unknown as LaunchAnalytics:emptyLaunch;
  const all=rows||[],total=(event:string)=>all.filter(row=>row.event_type===event).reduce((sum,row)=>sum+Number(row.event_count),0);
  const byEvent=Object.entries(all.reduce<Record<string,number>>((acc,row)=>({...acc,[row.event_type]:(acc[row.event_type]||0)+Number(row.event_count)}),{})).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(1,...byEvent.map(([,count])=>count));

  return <DashboardShell variant="admin" title="Platform analytics" description="Aggregated, privacy-safe engagement across public experiences." breadcrumbs={[{label:"Admin",href:"/admin"},{label:"Analytics"}]}>
    <form className="filter-bar"><label>From <input name="from" type="date" defaultValue={from}/></label><label>To <input name="to" type="date" defaultValue={to}/></label><button className="button button-small">Apply</button></form>
    <section className="dashboard-stat-grid"><StatCard label="Total visitors" value={visitors.total_visitors}/><StatCard label="Total visits" value={visitors.total_visits}/><StatCard label="Listing views" value={total("listing_view")}/><StatCard label="Search impressions" value={total("search_impression")}/><StatCard label="Enquiries submitted" value={total("enquiry_submitted")}/><StatCard label="Contact clicks" value={total("phone_click")+total("whatsapp_click")}/></section>
    {visitorError&&<p className="form-message error" role="alert">Visitor summaries require the latest analytics migration.</p>}
    <section className="dashboard-section"><ChartCard title="Event distribution"><div className="chart-bars">{byEvent.map(([event,count])=><div key={event}><i style={{height:`${count/max*100}%`}}/><small>{event.slice(0,10)}</small></div>)}</div></ChartCard></section>
    <section className="dashboard-section">{visitors.by_day.length?<DataTable caption="Visitors by date" headers={["Date","Visitors","Visits"]}>{visitors.by_day.map(row=><tr key={row.day}><td>{row.day}</td><td>{row.visitors}</td><td>{row.visits}</td></tr>)}</DataTable>:<EmptyState title="No visitor data" description="Visitor counts appear here after public page views are collected."/>}</section>
    <section className="dashboard-section">{visitors.by_location.length?<DataTable caption="Visitors by approximate location" headers={["Country","Region","City","Visitors","Visits"]}>{visitors.by_location.map((row,index)=><tr key={`${row.country}-${row.region}-${row.city}-${index}`}><td>{row.country}</td><td>{row.region}</td><td>{row.city}</td><td>{row.visitors}</td><td>{row.visits}</td></tr>)}</DataTable>:<EmptyState title="No location data" description="Approximate city and region counts appear when the hosting platform provides them."/>}</section>
    <section className="dashboard-grid-2"><div>{launch.by_service.length?<DataTable caption="Service engagement" headers={["Service","Events"]}>{launch.by_service.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.count}</td></tr>)}</DataTable>:<EmptyState title="No service data" description="Buy, rent, PG, NRI and agent activity appears after the launch migration is applied."/>}</div><div>{launch.by_source.length?<DataTable caption="Traffic sources" headers={["Source","Events"]}>{launch.by_source.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.count}</td></tr>)}</DataTable>:<EmptyState title="No source data" description="Direct, organic, referral and campaign sources appear here."/>}</div></section>
    <section className="dashboard-section">{launch.landing_pages.length?<DataTable caption="Landing pages" headers={["Page","Visitors","Visits"]}>{launch.landing_pages.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.visitors}</td><td>{row.count}</td></tr>)}</DataTable>:<EmptyState title="No landing-page data" description="Landing pages are recorded without query values that may contain personal information."/>}</section>
    <section className="dashboard-section">{launch.properties.length?<DataTable caption="Property engagement" headers={["Reference","Views","Visitors","WhatsApp","Phone","Map","Enquiries"]}>{launch.properties.map(row=><tr key={row.reference}><td>{row.reference}</td><td>{row.views}</td><td>{row.visitors}</td><td>{row.whatsapp}</td><td>{row.phone}</td><td>{row.map_clicks}</td><td>{row.enquiries}</td></tr>)}</DataTable>:<EmptyState title="No property engagement" description="Only actual published-listing activity is reported."/>}</section>
    <section className="dashboard-section">{byEvent.length?<DataTable caption="Analytics event totals" headers={["Event","Count"]}>{byEvent.map(([event,count])=><tr key={event}><td>{event.replaceAll("_"," ")}</td><td>{count}</td></tr>)}</DataTable>:<EmptyState title="No aggregated data" description="Run daily analytics aggregation after events are collected."/>}</section>
  </DashboardShell>;
}
