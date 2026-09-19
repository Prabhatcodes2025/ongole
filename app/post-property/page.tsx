import type { Metadata } from "next";
import { getPublicPropertyCatalog } from "@/src/lib/masters/public";
import {PublicPropertyPostingForm} from "@/src/components/property-posting-workflow";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {POSTING_ENTITLEMENT_MESSAGE} from "@/src/lib/properties/posting-entitlement";
import {env} from "@/src/lib/env";
import {PostingEntitlementActions} from "@/src/components/posting-entitlement-actions";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Post your property",description:"Submit a property for manual review and professional marketing on OngoleProperty.com.",robots:{index:false,follow:false}};
export default async function PostPropertyPage({searchParams}:{searchParams:Promise<{transaction?:string}>}){
  if(env.isSupabaseConfigured){const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();
    if(auth.user){const{data:permission,error}=await supabase.rpc("check_property_posting_permission");if(error||!(permission as {allowed?:boolean}|null)?.allowed)return <main id="main"><section className="section shell"><p className="form-message error" role="alert">{POSTING_ENTITLEMENT_MESSAGE}</p><PostingEntitlementActions/></section></main>}}
  const query=await searchParams,initialTransaction=query.transaction==="rent"?"rent":"sale";const catalog=await getPublicPropertyCatalog();return <main id="main"><section className="inner-hero editorial"><div className="shell"><p className="eyebrow">One free property per registered user</p><h1>Tell us about your property</h1><p>Complete the form now. You will sign in or register before anything is saved to the property database.</p></div></section><section className="section shell"><PublicPropertyPostingForm catalog={catalog} initialTransaction={initialTransaction}/></section></main>}
