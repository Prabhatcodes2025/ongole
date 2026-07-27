import type { MetadataRoute } from "next";
import { siteConfig } from "@/src/config/site";
import { getPublicPropertySlugs } from "@/src/lib/properties/public";
import {getPublicPgSlugs} from "@/src/lib/pg/public";

const staticRoutes=["","/about","/services","/properties","/agents","/paying-guest","/advertise-with-us","/contact","/privacy","/terms"];
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const now=new Date();const base=staticRoutes.map((path)=>({url:`${siteConfig.url}${path}`,lastModified:now,changeFrequency:path===""?"daily" as const:"weekly" as const,priority:path===""?1:path==="/properties"?.9:.7}));try{const[properties,pgs]=await Promise.all([getPublicPropertySlugs(),getPublicPgSlugs()]);return [...base,...properties.map((property)=>({url:`${siteConfig.url}/property/${property.slug}`,lastModified:property.publishedAt?new Date(property.publishedAt):now,changeFrequency:"weekly" as const,priority:.8})),...pgs.map((pg)=>({url:`${siteConfig.url}/paying-guest/${pg.slug}`,lastModified:pg.publishedAt?new Date(pg.publishedAt):now,changeFrequency:"weekly" as const,priority:.8}))]}catch{return base}}
