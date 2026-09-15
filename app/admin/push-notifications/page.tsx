import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {DashboardShell,StatCard,DataTable} from "@/src/components/dashboard/dashboard-shell";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Push Notifications",robots:{index:false,follow:false}};
export default async function AdminPushPage({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}){
  const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?returnTo=/admin/push-notifications");const {data:allowed}=await supabase.rpc("has_permission",{required_permission:"notifications.manage"});if(!allowed)redirect("/admin");
  const service=createSupabaseServiceClient();if(!service)return <DashboardShell variant="admin" title="Push Notifications"><p>Push service is not configured.</p></DashboardShell>;
  const today=new Date();today.setUTCHours(0,0,0,0);
  const [subscribers,active,disabled,requirements,sentToday,activity,properties,params]=await Promise.all([
    service.from("property_alert_preferences").select("user_id",{count:"exact",head:true}),
    service.from("property_alert_preferences").select("user_id",{count:"exact",head:true}).eq("enabled",true).eq("permission_status","granted"),
    service.from("property_alert_preferences").select("user_id",{count:"exact",head:true}).eq("enabled",false),
    service.from("property_alert_requirements").select("id",{count:"exact",head:true}),
    service.from("push_notification_logs").select("id",{count:"exact",head:true}).eq("status","sent").gte("sent_at",today.toISOString()),
    service.from("push_notification_logs").select("id,notification_type,property_id,title,status,created_at").order("created_at",{ascending:false}).limit(30),
    service.from("properties").select("id,title,reference_no").eq("status","published").is("deleted_at",null).order("published_at",{ascending:false}).limit(100),searchParams,
  ]);
  return <DashboardShell variant="admin" title="Push Notifications" description="Delivery status and controlled manual sends." breadcrumbs={[{label:"Admin",href:"/admin"},{label:"Push Notifications"}]}>
    {params.notice&&<p role="status">{params.notice==="queued"?"Notifications queued for eligible subscribers.":"Request completed."}</p>}{params.error&&<p role="alert" className="form-error">{params.error}</p>}
    <div className="dashboard-stat-grid"><StatCard label="Total subscribers" value={subscribers.count||0}/><StatCard label="Active subscribers" value={active.count||0}/><StatCard label="Disabled" value={disabled.count||0}/><StatCard label="Saved requirements" value={requirements.count||0}/><StatCard label="Sent today" value={sentToday.count||0}/></div>
    <div className="dashboard-grid-2"><section className="dashboard-card"><h2>Send property notification</h2><p>Matching users receive it only if their alerts match; all subscribers is capped and requires confirmation.</p><form method="post" action="/api/admin/push-notifications" className="admin-push-form"><input type="hidden" name="kind" value="property"/><label>Published property<select name="propertyId" required>{(properties.data||[]).map(property=><option key={property.id} value={property.id}>{property.title} ({property.reference_no})</option>)}</select></label><label>Audience<select name="scope"><option value="matching">Matching users</option><option value="all">All subscribers (maximum 500)</option></select></label><label>Title<input name="title" maxLength={120} defaultValue="New property on OngoleProperty.com" required/></label><label>Message<input name="body" maxLength={240} required/></label><label>Type SEND PUSH to confirm<input name="confirmation" autoComplete="off" required/></label><button className="button">Queue property notification</button></form></section>
    <section className="dashboard-card"><h2>Send general notification</h2><p>Limited to active subscribers; maximum 500 registrations.</p><form method="post" action="/api/admin/push-notifications" className="admin-push-form"><input type="hidden" name="kind" value="general"/><label>Title<input name="title" maxLength={120} required/></label><label>Message<input name="body" maxLength={240} required/></label><label>Type SEND PUSH to confirm<input name="confirmation" autoComplete="off" required/></label><button className="button">Queue general notification</button></form></section></div>
    <section className="dashboard-section"><h2>Recent notification activity</h2><DataTable caption="Recent notification activity" headers={["Type","Property","Title","Status","Created"]}>{(activity.data||[]).map(item=><tr key={item.id}><td>{item.notification_type}</td><td>{item.property_id||"—"}</td><td>{item.title}</td><td>{item.status}</td><td>{new Date(item.created_at).toLocaleString("en-IN")}</td></tr>)}</DataTable></section>
  </DashboardShell>;
}
