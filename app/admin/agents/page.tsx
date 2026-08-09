import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNavigation } from "@/src/components/admin-navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Agent applications",robots:{index:false,follow:false}};
const statuses=["","pending","active","rejected","suspended","blocked"];

export default async function AdminAgentsPage({searchParams}:{searchParams:Promise<{status?:string;q?:string}>}){
  const params=await searchParams;const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?returnTo=/admin/agents");
  const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"agents.read"});if(!allowed)redirect("/dashboard");
  let query=supabase.from("agents").select("id,reference_no,years_experience,office_address,about,working_towns,specializations,status,verified_at,created_at,profiles!inner(full_name,email,mobile)").order("created_at",{ascending:false}).limit(100);
  if(statuses.includes(params.status||"")&&params.status)query=query.eq("status",params.status);
  if(params.q)query=query.or(`reference_no.ilike.%${params.q.replace(/[%(),]/g,"")}%,about.ilike.%${params.q.replace(/[%(),]/g,"")}%`);
  const{data:agents,error}=await query;
  const{data:canManage}=await supabase.rpc("has_permission",{required_permission:"agents.manage"});
  return <main id="main" className="portal-page admin-portal"><div className="shell"><div className="portal-title"><div><p className="eyebrow">Professional network</p><h1>Agent applications</h1><p>Review pending professional profiles before public eligibility.</p></div></div><AdminNavigation/><form className="admin-filters"><input name="q" defaultValue={params.q} placeholder="Reference or profile text"/><select name="status" defaultValue={params.status||""}>{statuses.map((status)=><option value={status} key={status||"all"}>{status||"All statuses"}</option>)}</select><button className="button button-small">Search</button></form><section className="portal-section">{error?<div className="config-warning">Agent applications could not be loaded.</div>:agents?.length?<div className="agent-review-list">{agents.map((agent)=>{const profile=Array.isArray(agent.profiles)?agent.profiles[0]:agent.profiles;return <article key={agent.id}><header><div><p className="eyebrow">{agent.reference_no}</p><h2>{profile?.full_name||"Agent applicant"}</h2><p>{profile?.email} · {profile?.mobile}</p></div><span className={`status status-${agent.status}`}>{agent.status}</span></header><dl className="review-facts"><div><dt>Experience</dt><dd>{agent.years_experience==null?"Not provided":`${agent.years_experience} years`}</dd></div><div><dt>Working towns</dt><dd>{agent.working_towns?.join(", ")||"Not provided"}</dd></div><div><dt>Specialisations</dt><dd>{agent.specializations?.join(", ")||"Not provided"}</dd></div><div><dt>Office</dt><dd>{agent.office_address||"Not provided"}</dd></div>{agent.about&&<div className="wide"><dt>Introduction</dt><dd>{agent.about}</dd></div>}</dl>{canManage&&agent.status==="pending"&&<form className="agent-review-actions" action={`/api/admin/agents/${agent.id}/review`} method="post"><label>Review reason <span>(required for rejection)</span><textarea name="reason" rows={2} maxLength={1000}/></label><button className="button" name="action" value="approve">Approve Agent</button><button className="danger-button" name="action" value="reject">Reject</button></form>}</article>})}</div>:<div className="empty-state"><h2>No matching agent applications</h2><p>New real estate agent registrations will appear here for review.</p></div>}</section></div></main>;
}
