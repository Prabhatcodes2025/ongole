import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {DashboardShell} from "@/src/components/dashboard/dashboard-shell";
import {DashboardPropertyDraftForm} from "@/src/components/property-posting-workflow";
import {getPublicPropertyCatalog} from "@/src/lib/masters/public";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Post property",robots:{index:false,follow:false}};

export default async function NewPropertyPage(){
  const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)redirect("/login?returnTo=/dashboard/properties/new?restore=1");
  const[{data:permission,error},catalog]=await Promise.all([supabase.rpc("check_property_posting_permission"),getPublicPropertyCatalog()]);
  const context=permission as {allowed?:boolean}|null;
  if(error||!context?.allowed)return <DashboardShell title="Post property" description="Property posting permission"><section className="dashboard-card empty-state"><h2>ONE FREE PROPERTY PER REGISTERED USER</h2><p>A registered user can post only one free property.</p><p>For more details, please contact<br/>OngoleProperty.com</p><p><strong>Phone:</strong> 7788998459<br/><strong>Email:</strong> admin@ongoleproperty.com</p><a className="button" href="tel:+917788998459">CONTACT ADMIN</a><Link className="button button-light" href="/dashboard/properties">My Property</Link></section></DashboardShell>;
  return <DashboardShell title="Post property" description="Create a private draft, add images, preview it and submit it for administrator review." breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"My Property",href:"/dashboard/properties"},{label:"Post Property"}]}><section className="dashboard-card form-card"><DashboardPropertyDraftForm catalog={catalog}/></section></DashboardShell>;
}
