"use client";

import { Grid2X2, List } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PropertyCard } from "@/src/components/property-card";
import type { PublicProperty } from "@/src/types/property";

export function ListingResults({properties}:{properties:PublicProperty[]}){const params=useSearchParams();const router=useRouter();const urlView=params.get("view");const [view,setView]=useState<"grid"|"list">(()=>{if(urlView==="list")return "list";if(typeof window!=="undefined"&&!urlView&&sessionStorage.getItem("property-view")==="list")return "list";return "grid";});
  const change=(next:"grid"|"list")=>{setView(next);sessionStorage.setItem("property-view",next);const query=new URLSearchParams(params.toString());query.set("view",next);router.replace(`/properties?${query}`,{scroll:false});};
  return <><div className="view-toggle" role="group" aria-label="Property view"><button className={view==="grid"?"is-active":""} onClick={()=>change("grid")} aria-pressed={view==="grid"}><Grid2X2 size={17}/>Grid</button><button className={view==="list"?"is-active":""} onClick={()=>change("list")} aria-pressed={view==="list"}><List size={18}/>List</button></div><div className={view==="grid"?"property-grid":"property-list"}>{properties.map((property)=><PropertyCard key={property.id} property={property} view={view}/>)}</div></>}
