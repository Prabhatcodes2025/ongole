import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {DashboardShell} from "@/src/components/dashboard/dashboard-shell";
import {ReportExportGrid} from "@/src/components/dashboard/report-export-grid";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Reports",robots:{index:false,follow:false}};

export default async function ReportsPage(){
  const supabase=await createSupabaseServerClient();
  const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?returnTo=/admin/reports");
  const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"reports.read"});
  if(!allowed)redirect("/admin");
  const{data:plans}=await supabase.from("plans").select("id,name").order("display_order");
  return <DashboardShell variant="admin" title="Reports" description="Date-filterable, formula-safe CSV and Excel (XLSX) operational exports." breadcrumbs={[{label:"Admin",href:"/admin"},{label:"Reports"}]}>
    <ReportExportGrid plans={plans||[]}/>
  </DashboardShell>;
}
