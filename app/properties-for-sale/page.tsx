import type {Metadata} from "next";
import {PublicPropertyListingPage,type PropertySearchParams} from "@/src/components/public-property-listing-page";

export const revalidate=300;
export const metadata:Metadata={title:"Properties for Sale in Ongole & Prakasam",description:"Find verified houses, apartments, villas, plots, commercial and agricultural properties for sale in Ongole and Prakasam District.",alternates:{canonical:"/properties-for-sale"},openGraph:{title:"Properties for Sale in Ongole & Prakasam",url:"/properties-for-sale",type:"website"},twitter:{card:"summary_large_image",title:"Properties for Sale in Ongole & Prakasam"}};
export default function SalePage({searchParams}:{searchParams:Promise<PropertySearchParams>}){return <PublicPropertyListingPage searchParams={searchParams} basePath="/properties-for-sale" purpose="sale" eyebrow="Buy with local confidence" title="Properties for Sale in Ongole & Prakasam" description="Explore approved homes, plots, commercial spaces and agricultural land with useful local filters and protected contact details."/>}
