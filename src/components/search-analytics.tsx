"use client";

import {useEffect} from "react";

export function SearchAnalytics({query,resultCount}:{query:Record<string,string|string[]|undefined>;resultCount:number}){
  useEffect(()=>{if(!Object.values(query).some(Boolean))return;let sent=false;const send=()=>{if(sent)return;try{if(window.localStorage.getItem("ongoleproperty.analytics-consent")!=="granted")return}catch{return}sent=true;void fetch("/api/analytics/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query,resultCount}),keepalive:true})};const consent=(event:Event)=>{if((event as CustomEvent).detail==="granted")send()};send();window.addEventListener("op:analytics-consent",consent);return()=>window.removeEventListener("op:analytics-consent",consent)},[query,resultCount]);
  return null;
}
