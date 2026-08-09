import Link from "next/link";
import {Suspense} from "react";
import {ListingResults} from "@/src/components/listing-results";
import {Pagination} from "@/src/components/pagination";
import {PropertyFilterForm} from "@/src/components/property-filter-form";
import {PropertySearch} from "@/src/components/property-search";
import {EmptyState,ErrorState,PropertySkeletons} from "@/src/components/public-states";
import {SearchAnalytics} from "@/src/components/search-analytics";
import {SortControl} from "@/src/components/sort-control";
import {getPublicPropertyCatalog} from "@/src/lib/masters/public";
import {activeFilterEntries,parsePropertyFilters} from "@/src/lib/properties/filters";
import {listPublicProperties} from "@/src/lib/properties/public";

export type PropertySearchParams=Record<string,string|string[]|undefined>;
function urlParams(query:PropertySearchParams){const result=new URLSearchParams();Object.entries(query).forEach(([key,value])=>Array.isArray(value)?value.forEach((item)=>result.append(key,item)):value&&result.set(key,value));return result}

export async function PublicPropertyListingPage({searchParams,basePath="/properties",purpose,title,eyebrow="Verified property discovery",description}:{searchParams:Promise<PropertySearchParams>;basePath?:string;purpose?:"sale"|"rent";title:string;eyebrow?:string;description:string}){
  const raw=await searchParams;const filters=parsePropertyFilters({...raw,...(purpose?{purpose}: {})});const[result,catalog]=await Promise.all([listPublicProperties(filters),getPublicPropertyCatalog()]);const params=urlParams(raw);if(purpose)params.delete("purpose");const selected=activeFilterEntries(filters).filter(([key])=>!(purpose&&key==="purpose"));
  return <main id="main"><SearchAnalytics query={{...raw,...(purpose?{purpose}: {})}} resultCount={result.total}/><section className="inner-hero listing-hero"><div className="shell"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p><PropertySearch compact catalog={catalog} basePath={basePath} fixedPurpose={purpose}/><div className="listing-hero-actions"><Link className="button button-outline" href="/post-property">Post Property</Link></div></div></section><section className="section shell listing-shell">{result.source==="demo"&&<p className="demo-notice">Preview mode: Supabase is not configured, so clearly marked demonstration listings are shown.</p>}<PropertyFilterForm filters={filters} catalog={catalog} basePath={basePath} fixedPurpose={purpose}/><div className="listing-content"><div className="results-toolbar"><div><strong>{result.total}</strong> {result.total===1?"property":"properties"} found</div><Suspense fallback={null}><SortControl value={filters.sort} basePath={basePath}/></Suspense></div>{selected.length>0&&<div className="active-filters" aria-label="Selected filters">{selected.map(([key,value])=>{const next=new URLSearchParams(params);next.delete(key.replace(/Only$/,"").replace(/^verified$/,"verified"));next.delete("page");return <Link key={key} href={`${basePath}?${next}`}>{key.replace(/Only$/," ")}: {Array.isArray(value)?value.join(", "):String(value)} <span aria-hidden="true">×</span></Link>})}<Link className="clear-chip" href={basePath}>Clear all</Link></div>}{result.error?<ErrorState message={result.error}/>:result.properties.length?<><Suspense fallback={<PropertySkeletons count={filters.pageSize}/>}><ListingResults properties={result.properties} basePath={basePath}/></Suspense><Pagination page={result.page} total={result.total} pageSize={result.pageSize} params={params} basePath={basePath}/></>:<EmptyState/>}</div></section></main>
}
