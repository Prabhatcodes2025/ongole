import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {AnalyticsLocationFilters} from "@/src/components/admin/analytics-location-filters";
import {ChartCard,DashboardShell,DataTable,EmptyState,StatCard} from "@/src/components/dashboard/dashboard-shell";
import {PendingLink} from "@/src/components/pending-link";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Platform analytics",robots:{index:false,follow:false}};

type VisitorDay={day:string;visits:number;visitors:number};
type VisitorAnalytics={total_visits:number;total_visitors:number;by_day:VisitorDay[]};
type VisitorLocation={country:string;region:string;city:string;page_views:number;visitors:number};
type LocationAnalytics={total_page_views:number;total_visitors:number;total_rows:number;countries:string[];regions:string[];cities:string[];rows:VisitorLocation[]};
type Breakdown={name:string;count:number};
type LaunchAnalytics={by_service:Breakdown[];by_source:Breakdown[];landing_pages:{name:string;count:number;visitors:number}[];properties:{reference:string;views:number;visitors:number;whatsapp:number;phone:number;map_clicks:number;enquiries:number}[]};
type Params={from?:string;to?:string;country?:string;region?:string;city?:string;sort?:string;direction?:string;page?:string};
const emptyVisitors:VisitorAnalytics={total_visits:0,total_visitors:0,by_day:[]};
const emptyLocations:LocationAnalytics={total_page_views:0,total_visitors:0,total_rows:0,countries:[],regions:[],cities:[],rows:[]};
const emptyLaunch:LaunchAnalytics={by_service:[],by_source:[],landing_pages:[],properties:[]};
const isoDate=(value:string|undefined,fallback:string)=>value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:fallback;
const locationValue=(value:string|undefined)=>value?.trim().slice(0,100)||"";

export default async function AdminAnalytics({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams,supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?returnTo=/admin/analytics");
  const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"analytics.read"});if(!allowed)redirect("/admin");

  const today=new Date(),monthStart=new Date();monthStart.setDate(monthStart.getDate()-29);
  const defaultTo=today.toISOString().slice(0,10),defaultFrom=monthStart.toISOString().slice(0,10),requestedFrom=isoDate(params.from,defaultFrom),requestedTo=isoDate(params.to,defaultTo);
  const[from,to]=requestedFrom<=requestedTo?[requestedFrom,requestedTo]:[defaultFrom,defaultTo];
  const requestedPage=Number(params.page),page=Number.isSafeInteger(requestedPage)&&requestedPage>0?requestedPage:1,pageSize=25,country=locationValue(params.country),region=locationValue(params.region),city=locationValue(params.city),sort=params.sort==="page_views"?"page_views" as const:"visitors" as const,direction=params.direction==="asc"?"asc" as const:"desc" as const;
  const[{data:rows},{data:visitorResult,error:visitorError},{data:locationResult,error:locationError},{data:launchResult}]=await Promise.all([
    supabase.from("analytics_daily").select("day,entity_type,event_type,event_count").gte("day",from).lte("day",to),
    supabase.rpc("get_visitor_analytics",{date_from:from,date_to:to}),
    supabase.rpc("get_visitor_location_analytics",{date_from:from,date_to:to,country_filter:country||null,region_filter:region||null,city_filter:city||null,sort_by:sort,sort_direction:direction,page_number:page,page_size:pageSize}),
    supabase.rpc("get_launch_analytics",{date_from:from,date_to:to}),
  ]);
  const visitors=!visitorError&&visitorResult&&typeof visitorResult==="object"&&!Array.isArray(visitorResult)?visitorResult as unknown as VisitorAnalytics:emptyVisitors;
  const locations=!locationError&&locationResult&&typeof locationResult==="object"&&!Array.isArray(locationResult)?locationResult as unknown as LocationAnalytics:emptyLocations;
  const launch=launchResult&&typeof launchResult==="object"&&!Array.isArray(launchResult)?launchResult as unknown as LaunchAnalytics:emptyLaunch;
  const all=rows||[],total=(event:string)=>all.filter(row=>row.event_type===event).reduce((sum,row)=>sum+Number(row.event_count),0),byEvent=Object.entries(all.reduce<Record<string,number>>((acc,row)=>({...acc,[row.event_type]:(acc[row.event_type]||0)+Number(row.event_count)}),{})).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...byEvent.map(([,count])=>count));
  const totalVisitors=locationError?visitors.total_visitors:locations.total_visitors,totalPageViews=locationError?visitors.total_visits:locations.total_page_views,pages=Math.max(1,Math.ceil(locations.total_rows/pageSize));
  const clean=new URLSearchParams({from,to,sort,direction});for(const[key,value]of [["country",country],["region",region],["city",city]] as const)if(value)clean.set(key,value);const pageHref=(target:number)=>{const next=new URLSearchParams(clean);next.set("page",String(target));return`/admin/analytics?${next}`};

  return <DashboardShell variant="admin" title="Platform analytics" description="Aggregated, privacy-safe engagement across public experiences." breadcrumbs={[{label:"Admin",href:"/admin"},{label:"Analytics"}]}>
    <AnalyticsLocationFilters from={from} to={to} country={country} region={region} city={city} sort={sort} direction={direction} countries={locations.countries} regions={locations.regions} cities={locations.cities}/>
    <section className="dashboard-stat-grid"><StatCard label="Total visitors" value={totalVisitors}/><StatCard label="Total page views" value={totalPageViews}/><StatCard label="Listing views" value={total("listing_view")}/><StatCard label="Search impressions" value={total("search_impression")}/><StatCard label="Enquiries submitted" value={total("enquiry_submitted")}/><StatCard label="Contact clicks" value={total("phone_click")+total("whatsapp_click")}/></section>
    {(visitorError||locationError)&&<p className="form-message error" role="alert">Visitor location summaries require the latest analytics migration.</p>}
    <section className="dashboard-section"><ChartCard title="Event distribution"><div className="chart-bars">{byEvent.map(([event,count])=><div key={event}><i style={{height:`${count/max*100}%`}}/><small>{event.slice(0,10)}</small></div>)}</div></ChartCard></section>
    <section className="dashboard-section">{visitors.by_day.length?<DataTable caption="Visitors by date" headers={["Date","Visitors","Page views"]}>{visitors.by_day.map(row=><tr key={row.day}><td>{row.day}</td><td>{row.visitors}</td><td>{row.visits}</td></tr>)}</DataTable>:<EmptyState title="No visitor data" description="Visitor counts appear here after consented public page views are collected."/>}</section>
    <section className="dashboard-section"><div className="dashboard-section-head"><div><h2>Visitors by approximate location</h2><p>Country → region/state → city from trusted hosting metadata. Unknown means the provider supplied no value.</p></div></div>{locations.rows.length?<><DataTable caption={`Visitor locations sorted by ${sort.replace("_"," ")} ${direction}`} headers={["Country","Region / state","City","Visitors","Page views"]}>{locations.rows.map(row=><tr key={`${row.country}-${row.region}-${row.city}`}><td>{row.country}</td><td>{row.region}</td><td>{row.city}</td><td>{row.visitors}</td><td>{row.page_views}</td></tr>)}</DataTable><nav className="pagination" aria-label="Location pages">{page>1&&<PendingLink href={pageHref(page-1)}>Previous</PendingLink>}<span>Page {page} of {pages}</span>{page<pages&&<PendingLink href={pageHref(page+1)}>Next</PendingLink>}</nav></>:<EmptyState title="No location data" description="Approximate location counts appear only for consented future events when the hosting platform provides them."/>}</section>
    <section className="dashboard-grid-2"><div>{launch.by_service.length?<DataTable caption="Service engagement" headers={["Service","Events"]}>{launch.by_service.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.count}</td></tr>)}</DataTable>:<EmptyState title="No service data" description="Buy, rent, PG, NRI and agent activity appears after the launch migration is applied."/>}</div><div>{launch.by_source.length?<DataTable caption="Traffic sources" headers={["Source","Events"]}>{launch.by_source.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.count}</td></tr>)}</DataTable>:<EmptyState title="No source data" description="Direct, organic, referral and campaign sources appear here."/>}</div></section>
    <section className="dashboard-section">{launch.landing_pages.length?<DataTable caption="Landing pages" headers={["Page","Visitors","Visits"]}>{launch.landing_pages.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.visitors}</td><td>{row.count}</td></tr>)}</DataTable>:<EmptyState title="No landing-page data" description="Landing pages are recorded as normalized paths without query tracking parameters."/>}</section>
    <section className="dashboard-section">{launch.properties.length?<DataTable caption="Property engagement" headers={["Reference","Views","Visitors","WhatsApp","Phone","Map","Enquiries"]}>{launch.properties.map(row=><tr key={row.reference}><td>{row.reference}</td><td>{row.views}</td><td>{row.visitors}</td><td>{row.whatsapp}</td><td>{row.phone}</td><td>{row.map_clicks}</td><td>{row.enquiries}</td></tr>)}</DataTable>:<EmptyState title="No property engagement" description="Only actual published-listing activity is reported."/>}</section>
    <section className="dashboard-section">{byEvent.length?<DataTable caption="Analytics event totals" headers={["Event","Count"]}>{byEvent.map(([event,count])=><tr key={event}><td>{event.replaceAll("_"," ")}</td><td>{count}</td></tr>)}</DataTable>:<EmptyState title="No aggregated data" description="Run daily analytics aggregation after events are collected."/>}</section>
  </DashboardShell>;
}
