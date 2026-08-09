import type {Metadata} from "next";
import {PublicPropertyListingPage,type PropertySearchParams} from "@/src/components/public-property-listing-page";
import {parsePropertyFilters} from "@/src/lib/properties/filters";
export {listPublicProperties} from "@/src/lib/properties/public";

export const revalidate=300;
export async function generateMetadata({searchParams}:{searchParams:Promise<PropertySearchParams>}):Promise<Metadata>{const filters=parsePropertyFilters(await searchParams);const qualifiers=[filters.purpose&&`${filters.purpose} properties`,filters.category,filters.location&&`in ${filters.location}`].filter(Boolean).join(" ");const title=qualifiers?`${qualifiers.replace(/^./,(value)=>value.toUpperCase())} | Ongole Property Listings`:"Properties in Ongole & Prakasam";return{title,description:`Search approved ${qualifiers||"residential, commercial and agricultural properties"} across Ongole and Prakasam District.`,alternates:{canonical:"/properties"},robots:{index:true,follow:true},openGraph:{title,url:"/properties",type:"website"},twitter:{card:"summary_large_image",title}}}
export default function PropertiesPage({searchParams}:{searchParams:Promise<PropertySearchParams>}){return <PublicPropertyListingPage searchParams={searchParams} title="Properties in Ongole & Prakasam" description="Search approved residential, commercial and agricultural opportunities with practical filters and protected owner privacy."/>}
