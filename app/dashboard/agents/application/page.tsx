import {redirect} from "next/navigation";
import {DashboardShell} from "@/src/components/dashboard/dashboard-shell";
import {AgentApplicationSubmit} from "@/src/components/agent-application-submit";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export default async function AgentApplicationPage(){
 const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login?returnTo=%2Fdashboard%2Fagents%2Fapplication%3Frestore%3D1");
 const{data:profile}=await supabase.from("profiles").select("full_name,email,mobile,account_type").eq("id",user.id).maybeSingle();
 if(!profile||profile.account_type!=="agent")return <DashboardShell title="Agent application" description="Real Estate Agent Network"><section className="dashboard-card empty-state"><h2>Agent account required</h2><p>Sign in with or register an agent account to submit a private application.</p></section></DashboardShell>;
 return <DashboardShell title="Agent application" description="Submit a private application for administrator review." breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"Agent application"}]}><section className="dashboard-card form-card"><AgentApplicationSubmit identity={{name:profile.full_name||"",mobile:profile.mobile||"",email:profile.email||user.email||""}}/></section></DashboardShell>;
}
