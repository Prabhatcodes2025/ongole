import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {DashboardPgDraftForm} from "@/src/components/pg-posting-workflow";
import {POSTING_ENTITLEMENT_MESSAGE} from "@/src/lib/properties/posting-entitlement";
import {PostingEntitlementActions} from "@/src/components/posting-entitlement-actions";

export const metadata:Metadata={title:"Create PG listing",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";

export default async function NewPgPage(){
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/post-pg");
  const{data:permission,error}=await supabase.rpc("check_property_posting_permission");
  if(error||!(permission as {allowed?:boolean}|null)?.allowed)return <main id="main" className="portal-page"><div className="shell narrow-shell"><section className="dashboard-card empty-state"><h1>Property posting permission</h1><p>{POSTING_ENTITLEMENT_MESSAGE}</p><PostingEntitlementActions/></section></div></main>;
  return <main id="main" className="portal-page"><div className="shell narrow-shell">
    <nav className="breadcrumbs"><Link href="/dashboard/pg">PG dashboard</Link><span>›</span><span>New listing</span></nav>
    <div className="portal-title"><div><p className="eyebrow">New paying guest listing</p><h1>Create a PG Listing Form</h1><p>Complete the listing details, then add rooms and photos before submitting for administrator review.</p></div></div>
    <section className="portal-section"><DashboardPgDraftForm/></section>
  </div></main>;
}
