"use client";

import { Filter, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { fallbackPropertyCatalog, furnishingOptions, typesFromCatalog, type PropertyCatalogData } from "@/src/config/property-catalog";
import type { PropertyFilters } from "@/src/types/property";

export function PropertyFilterForm({filters,catalog=fallbackPropertyCatalog}:{filters:PropertyFilters;catalog?:PropertyCatalogData}){
  const [open,setOpen]=useState(false);const [category,setCategory]=useState(filters.category||"");
  const form=<form className="filter-form" action="/properties" method="get"><div className="filter-form-head"><h2>Filter properties</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Close filters"><X/></button></div>
    <label>Keyword<input name="q" defaultValue={filters.keyword} placeholder="Title or property ID"/></label>
    <label>Transaction<select name="purpose" defaultValue={filters.purpose||""}><option value="">Sale, rent or lease</option><option value="sale">Sale</option><option value="rent">Rent</option><option value="lease">Lease</option></select></label>
    <label>Category<select name="category" value={category} onChange={(event)=>setCategory(event.target.value)}><option value="">All categories</option>{catalog.categories.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>Property type<select name="type" defaultValue={filters.type||""}><option value="">All property types</option>{typesFromCatalog(catalog,category).map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label>Location<input name="location" defaultValue={filters.location} placeholder="Locality or town"/></label>
    <fieldset><legend>Budget (₹)</legend><div className="field-pair"><label>From<input name="minPrice" defaultValue={filters.minPrice} type="number" min="0" step="10000" aria-label="Budget from in rupees"/></label><label>To<input name="maxPrice" defaultValue={filters.maxPrice} type="number" min="0" step="10000" aria-label="Budget to in rupees"/></label></div></fieldset>
    <fieldset><legend>Area (square feet equivalent)</legend><div className="field-pair"><label>From<input name="minArea" defaultValue={filters.minArea} type="number" min="0" aria-label="Area from in square feet"/></label><label>To<input name="maxArea" defaultValue={filters.maxArea} type="number" min="0" aria-label="Area to in square feet"/></label></div></fieldset>
    <div className="field-pair"><label>Bedrooms<select name="bedrooms" defaultValue={filters.bedrooms||""}><option value="">Any</option>{[1,2,3,4,5].map((value)=><option key={value}>{value}</option>)}</select></label><label>Bathrooms<select name="bathrooms" defaultValue={filters.bathrooms||""}><option value="">Any</option>{[1,2,3,4,5].map((value)=><option key={value}>{value}</option>)}</select></label></div>
    <label>Facing<select name="facing" defaultValue={filters.facing||""}><option value="">Any facing</option>{catalog.facings.map((value)=><option key={value}>{value}</option>)}</select></label><label>Furnishing<select name="furnishing" defaultValue={filters.furnishing||""}><option value="">Any furnishing</option>{furnishingOptions.map((value)=><option key={value}>{value}</option>)}</select></label>
    <fieldset><legend>Amenities</legend><div className="check-grid">{catalog.amenities.map((amenity)=><label key={amenity}><input type="checkbox" name="amenities" value={amenity} defaultChecked={filters.amenities?.includes(amenity)}/>{amenity}</label>)}</div></fieldset>
    <input type="hidden" name="sort" value={filters.sort}/><button className="button" type="submit">Apply filters</button><Link className="clear-filters" href="/properties"><RotateCcw size={15}/>Clear all filters</Link>
  </form>;
  return <><button className="mobile-filter-button" type="button" onClick={()=>setOpen(true)} aria-expanded={open} aria-controls="property-filters"><Filter size={18}/>Filters</button><aside id="property-filters" className={`filter-sidebar ${open?"is-open":""}`}>{form}</aside>{open&&<button className="filter-backdrop" onClick={()=>setOpen(false)} aria-label="Close filters"/>}</>;
}
