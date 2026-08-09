"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { fallbackPropertyCatalog, typesFromCatalog, type PropertyCatalogData } from "@/src/config/property-catalog";

export function PropertySearch({compact=false,catalog=fallbackPropertyCatalog}:{compact?:boolean;catalog?:PropertyCatalogData}){
  const [category,setCategory]=useState(""),[type,setType]=useState("");const types=useMemo(()=>typesFromCatalog(catalog,category),[catalog,category]);
  return <form className={`search-panel ${compact?"compact":""}`} action="/properties" method="get" aria-label="Search properties">
    <label><span>Looking to</span><select name="purpose" defaultValue="sale"><option value="sale">Buy</option><option value="rent">Rent</option><option value="lease">Lease</option></select></label>
    <label><span>Category</span><select name="category" value={category} onChange={(event)=>{setCategory(event.target.value);setType("")}}><option value="">All categories</option>{catalog.categories.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label><span>Property type</span><select name="type" value={type} onChange={(event)=>setType(event.target.value)}><option value="">All property types</option>{types.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label className="search-location"><span>Location</span><input name="location" list="property-location-options" autoComplete="off" aria-autocomplete="list" placeholder="Type a locality" maxLength={100}/><datalist id="property-location-options">{catalog.locations.map((location)=><option key={location} value={location}/>)}</datalist></label>
    <label><span>Budget from</span><input name="minPrice" type="number" min="0" step="10000" inputMode="numeric" aria-label="Budget from in rupees"/></label>
    <label><span>Budget to</span><input name="maxPrice" type="number" min="0" step="10000" inputMode="numeric" aria-label="Budget to in rupees"/></label>
    <input type="hidden" name="sort" value="newest"/><button className="button" type="submit"><Search size={18} aria-hidden="true"/>Search properties</button>
  </form>;
}
