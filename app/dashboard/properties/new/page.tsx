import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {DashboardShell} from "@/src/components/dashboard/dashboard-shell";
import {DashboardPropertyDraftForm} from "@/src/components/property-posting-workflow";
import {getPublicPropertyCatalog} from "@/src/lib/masters/public";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {POSTING_ENTITLEMENT_MESSAGE} from "@/src/lib/properties/posting-entitlement";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Post property",robots:{index:false,follow:false}};

export default async function NewPropertyPage(){
  const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)redirect("/login?returnTo=/dashboard/properties/new?restore=1");
  const[{data:permission,error},catalog]=await Promise.all([supabase.rpc("check_property_posting_permission"),getPublicPropertyCatalog()]);
  const context=permission as {allowed?:boolean}|null;
  if(error||!context?.allowed)return <DashboardShell title="Post property" description="Property posting permission"><section className="dashboard-card empty-state"><p>{POSTING_ENTITLEMENT_MESSAGE}</p><Link className="button button-light" href="/dashboard/properties">My Property</Link></section></DashboardShell>;
  return <DashboardShell title="Post property" description="Create a private draft, add images, preview it and submit it for administrator review." breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"My Property",href:"/dashboard/properties"},{label:"Post Property"}]}><section className="dashboard-card form-card"><DashboardPropertyDraftForm catalog={catalog}/></section></DashboardShell>;
}
