import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {DashboardPgDraftForm} from "@/src/components/pg-posting-workflow";

export const metadata:Metadata={title:"Create PG listing",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";

export default async function NewPgPage(){
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/post-pg");
  const{data:permission,error}=await supabase.rpc("check_property_posting_permission");
  if(error||!(permission as {allowed?:boolean}|null)?.allowed)return <main id="main" className="portal-page"><div className="shell narrow-shell"><section className="dashboard-card empty-state"><h1>ONE FREE PROPERTY PER REGISTERED USER</h1><p>A registered user can post only one free property. This includes Paying Guest listings.</p><p>For more details, please contact OngoleProperty.com<br/>Phone: 7788998459<br/>Email: admin@ongoleproperty.com</p><a className="button" href="tel:+917788998459">CONTACT ADMIN</a></section></div></main>;
  return <main id="main" className="portal-page"><div className="shell narrow-shell">
    <nav className="breadcrumbs"><Link href="/dashboard/pg">PG dashboard</Link><span>›</span><span>New listing</span></nav>
    <div className="portal-title"><div><p className="eyebrow">New paying guest listing</p><h1>Create a PG Listing Form</h1><p>Complete the listing details, then add rooms and photos before submitting for administrator review.</p></div></div>
    <section className="portal-section"><DashboardPgDraftForm/></section>
  </div></main>;
}
