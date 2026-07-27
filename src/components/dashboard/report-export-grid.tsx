"use client";

import {useMemo,useState} from "react";

const reports=[
  ["users","User registrations"],["properties","Property listings"],["pg","PG listings"],
  ["approval_turnaround","Approval turnaround"],["enquiries","Enquiries"],["subscriptions","Subscriptions"],
  ["payments","Payments"],["revenue","Revenue"],["promotions","Promotions"],
  ["advertisements","Advertisements"],["geographic","Geographic activity"],
] as const;

export function ReportExportGrid({plans}:{plans:{id:string;name:string}[]}){
  const[from,setFrom]=useState(""),[to,setTo]=useState(""),[status,setStatus]=useState(""),[plan,setPlan]=useState("");
  const query=useMemo(()=>{const params=new URLSearchParams();if(from)params.set("from",from);if(to)params.set("to",to);if(status)params.set("status",status);if(plan)params.set("plan",plan);return params.toString()},[from,to,status,plan]);
  const href=(entity:string,format:"csv"|"xlsx")=>`/api/admin/reports/${entity}?format=${format}${query?`&${query}`:""}`;
  return <>
    <div className="filter-bar" aria-label="Report filters">
      <label>From <input type="date" value={from} onChange={(event)=>setFrom(event.target.value)}/></label>
      <label>To <input type="date" value={to} min={from||undefined} onChange={(event)=>setTo(event.target.value)}/></label>
      <label>Status <input value={status} maxLength={40} placeholder="e.g. active" onChange={(event)=>setStatus(event.target.value)}/></label>
      <label>Plan <select value={plan} onChange={(event)=>setPlan(event.target.value)}><option value="">All plans</option>{plans.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <button className="button button-light button-small" type="button" onClick={()=>{setFrom("");setTo("");setStatus("");setPlan("")}}>Clear</button>
    </div>
    <section className="report-grid">{reports.map(([entity,label])=><article className="dashboard-card" key={entity}><h2>{label}</h2><p>Up to 10,000 authorised records. Every export is audited.</p><div className="dashboard-title-actions"><a className="button button-light" href={href(entity,"csv")}>CSV</a><a className="button" href={href(entity,"xlsx")}>Excel</a></div></article>)}</section>
  </>;
}
