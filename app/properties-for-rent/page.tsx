import type {Metadata} from "next";
import {PublicPropertyListingPage,type PropertySearchParams} from "@/src/components/public-property-listing-page";

export const revalidate=300;
export const metadata:Metadata={title:"Properties for Rent / Lease in Ongole & Prakasam",description:"Find verified houses, apartments, villas, shops and offices for Rent/Lease in Ongole and Prakasam District. Paying Guest accommodation remains separately listed.",alternates:{canonical:"/properties-for-rent"},openGraph:{title:"Properties for Rent / Lease in Ongole & Prakasam",url:"/properties-for-rent",type:"website"},twitter:{card:"summary_large_image",title:"Properties for Rent / Lease in Ongole & Prakasam"}};
export default function RentPage({searchParams}:{searchParams:Promise<PropertySearchParams>}){return <PublicPropertyListingPage searchParams={searchParams} basePath="/properties-for-rent" purpose="rent" eyebrow="Rent / Lease properties" title="Properties for Rent / Lease in Ongole & Prakasam" description="Search approved houses, flats and commercial properties for Rent/Lease. Paying Guest accommodation is managed separately in the dedicated PG section."/>}
