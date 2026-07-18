"use client";

import {useEffect} from "react";

export function SearchAnalytics({query,resultCount}:{query:Record<string,string|string[]|undefined>;resultCount:number}){
  useEffect(()=>{if(!Object.values(query).some(Boolean))return;void fetch("/api/analytics/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query,resultCount}),keepalive:true});},[query,resultCount]);
  return null;
}
