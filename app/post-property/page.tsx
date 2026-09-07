import type { Metadata } from "next";
import { getPublicPropertyCatalog } from "@/src/lib/masters/public";
import {PublicPropertyPostingForm} from "@/src/components/property-posting-workflow";
export const metadata:Metadata={title:"Post your property",description:"Submit a property for manual review and professional marketing on OngoleProperty.com.",robots:{index:false,follow:false}};
export default async function PostPropertyPage(){const catalog=await getPublicPropertyCatalog();return <main id="main"><section className="inner-hero editorial"><div className="shell"><p className="eyebrow">One free property per registered user</p><h1>Tell us about your property</h1><p>Complete the form now. You will sign in or register before anything is saved to the property database.</p></div></section><section className="section shell"><PublicPropertyPostingForm catalog={catalog}/></section></main>}
