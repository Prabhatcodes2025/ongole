import type{Metadata}from"next";
import{redirect}from"next/navigation";
import{DashboardShell}from"@/src/components/dashboard/dashboard-shell";
import{createSupabaseServerClient}from"@/src/lib/supabase/server";
import{safeReturnPath}from"@/src/lib/auth/session";
import{AccountDeactivationForm}from"@/src/components/account-deactivation-form";
import{ProfileMobileForm}from"@/src/components/profile-mobile-form";

export const dynamic="force-dynamic";export const metadata:Metadata={title:"Profile",robots:{index:false,follow:false}};
export default async function ProfilePage({searchParams}:{searchParams:Promise<{notice?:string;complete?:string;returnTo?:string;error?:string}>}){
  const params=await searchParams;const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)redirect("/login?returnTo=/dashboard/profile");const{data:profile}=await supabase.from("profiles").select("full_name,email,mobile,account_type,reference_no").eq("id",auth.user.id).single();const completing=params.complete==="1";
  return <DashboardShell title={completing?"Complete Your Profile":"Profile"} description={completing?"Add your mandatory mobile number before continuing to the dashboard.":"Keep your account and business contact details current."} breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"Profile"}]}>{params.notice==="updated"&&<p className="form-message success">Profile updated.</p>}<section className="dashboard-card form-card"><ProfileMobileForm completing={completing} returnTo={completing?safeReturnPath(params.returnTo):undefined} initialError={params.error} profile={profile}/></section>{!completing&&profile?.account_type!=="admin"&&<section className="dashboard-card form-card danger-zone"><h2>Delete my account</h2><p>This safely deactivates access. Your historical listings and business records are retained.</p><AccountDeactivationForm/></section>}</DashboardShell>;
}
