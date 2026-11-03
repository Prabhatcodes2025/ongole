"use client";

import {useRouter} from "next/navigation";
import {useTransition} from "react";
import {PendingSubmitButton} from "@/src/components/pending-submit-button";

type Props={from:string;to:string;country:string;region:string;city:string;sort:"country"|"region"|"city"|"visitors"|"page_views";direction:"asc"|"desc";countries:string[];regions:string[];cities:string[]};

export function AnalyticsLocationFilters(props:Props){
  const router=useRouter(),[pending,startTransition]=useTransition();
  const navigate=(level:"country"|"region"|"city"|"sort"|"direction",value:string)=>{const query=new URLSearchParams({from:props.from,to:props.to,sort:props.sort,direction:props.direction});for(const[key,current]of [["country",props.country],["region",props.region],["city",props.city]] as const)if(current)query.set(key,current);if(value)query.set(level,value);else query.delete(level);if(level==="country"){query.delete("region");query.delete("city")}if(level==="region")query.delete("city");query.delete("page");startTransition(()=>router.replace(`/admin/analytics?${query}`))};
  const options=(values:string[],current:string)=>current&&!values.includes(current)?[current,...values]:values;
  return <form className="filter-bar analytics-location-filters" action="/admin/analytics" aria-busy={pending}>
    <label>From <input name="from" type="date" defaultValue={props.from} disabled={pending}/></label><label>To <input name="to" type="date" defaultValue={props.to} disabled={pending}/></label>
    <label>Country <select name="country" value={props.country} disabled={pending} onChange={event=>navigate("country",event.target.value)}><option value="">All countries</option>{options(props.countries,props.country).map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Region / state <select name="region" value={props.region} disabled={pending} onChange={event=>navigate("region",event.target.value)}><option value="">All regions</option>{options(props.regions,props.region).map(value=><option key={value}>{value}</option>)}</select></label>
    <label>City <select name="city" value={props.city} disabled={pending} onChange={event=>navigate("city",event.target.value)}><option value="">All cities</option>{options(props.cities,props.city).map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Sort by <select name="sort" value={props.sort} disabled={pending} onChange={event=>navigate("sort",event.target.value)}><option value="visitors">Visitors</option><option value="page_views">Page views</option></select></label>
    <label>Direction <select name="direction" value={props.direction} disabled={pending} onChange={event=>navigate("direction",event.target.value)}><option value="desc">Highest first</option><option value="asc">Lowest first</option></select></label>
    <PendingSubmitButton className="button button-small" pendingText="Applying…">Apply</PendingSubmitButton>{pending&&<span className="form-pending-status" role="status" aria-live="polite"><i className="pending-spinner" aria-hidden="true"/>Updating locations…</span>}
  </form>;
}
