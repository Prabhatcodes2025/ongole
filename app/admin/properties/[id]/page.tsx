import type {Metadata} from "next";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {AdminNavigation} from "@/src/components/admin-navigation";
import {PERMISSIONS} from "@/src/lib/auth/permissions";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Review property",robots:{index:false,follow:false}};

export default async function ReviewPropertyPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();if(!auth.user)redirect(`/login?returnTo=/admin/properties/${id}`);const [{data:canRead},{data:canManage}]=await Promise.all([supabase.rpc("has_permission",{required_permission:PERMISSIONS.propertiesRead}),supabase.rpc("has_permission",{required_permission:PERMISSIONS.propertiesManage})]);if(!canRead)redirect("/dashboard");
  const [{data:p},{data:history},{data:audit}]=await Promise.all([
    supabase.from("properties").select("*,profiles!properties_owner_id_fkey(full_name,reference_no,email),property_media(id,storage_path,processing_status,is_cover,sort_order)").eq("id",id).single(),
    supabase.from("property_status_history").select("id,from_status,to_status,reason,created_at").eq("property_id",id).order("created_at",{ascending:false}),
    supabase.from("audit_logs").select("id,action,outcome,created_at").eq("entity_type","property").order("created_at",{ascending:false}).limit(20),
  ]);if(!p)notFound();
  return <main id="main" className="portal-page admin-portal"><div className="shell">
    <nav className="breadcrumbs"><Link href="/admin">Admin</Link><span>›</span><Link href="/admin/properties">Properties</Link><span>›</span><span>{p.reference_no}</span></nav>
    <div className="portal-title"><div><p className="eyebrow">{p.reference_no}</p><h1>{p.title}</h1><p>{p.locality_text}, {p.city_text} · <span className={`status status-${p.status}`}>{p.status.replaceAll("_"," ")}</span></p></div></div>
    <AdminNavigation/>
    <div className="review-layout"><section className="portal-section"><h2>Submitted information</h2><dl className="review-facts">
      <div><dt>Owner</dt><dd>{p.profiles?.full_name} ({p.profiles?.reference_no})</dd></div><div><dt>Transaction</dt><dd>{p.transaction_type}</dd></div><div><dt>Price</dt><dd>₹{Number(p.price_inr||0).toLocaleString("en-IN")}</dd></div><div><dt>Area</dt><dd>{p.area_value} {p.area_unit}</dd></div><div><dt>Flags</dt><dd>{[p.is_verified&&"Verified",p.is_featured&&"Featured",p.is_pinned&&"Pinned"].filter(Boolean).join(", ")||"None"}</dd></div><div className="wide"><dt>Description</dt><dd>{p.description}</dd></div><div className="wide"><dt>Additional fields</dt><dd><pre>{JSON.stringify(p.details,null,2)}</pre></dd></div>
    </dl><h2>Media checks</h2><p>{p.property_media?.length||0} media records; {p.property_media?.filter((item:{processing_status:string})=>item.processing_status==="ready").length||0} ready.</p><h2>Property history</h2><ol className="timeline">{history?.map((item)=><li key={item.id}><strong>{item.to_status.replaceAll("_"," ")}</strong><span>{new Date(item.created_at).toLocaleString("en-IN")}</span>{item.reason&&<p>{item.reason}</p>}</li>)}</ol><h2>Audit trail</h2><ol className="activity-list">{audit?.map((item)=><li key={item.id}><strong>{item.action}</strong><span>{item.outcome} · {new Date(item.created_at).toLocaleString("en-IN")}</span></li>)}</ol></section>
    <aside className="review-actions"><p className="eyebrow">Decision</p><h2>Review outcome</h2>
      {p.status==="draft"&&<p className="form-message">This property is still a draft. Approval actions become available after the owner submits it for review.</p>}
      {p.status==="pending_review"&&!canManage&&<p className="form-message error" role="alert">This account can view the review queue but does not have property approval permission.</p>}
      {p.status==="pending_review"&&canManage&&<><form action={`/api/admin/properties/${id}/status`} method="post"><button className="button" name="action" value="approve">Approve property</button></form><form action={`/api/admin/properties/${id}/status`} method="post"><label>Decision reason<textarea required name="reason" rows={4}/></label><button className="button button-light" name="action" value="request_changes">Request changes</button><button className="danger-button" name="action" value="reject">Reject</button></form></>}
      {p.status==="approved"&&canManage&&<form action={`/api/admin/properties/${id}/status`} method="post"><button className="button" name="action" value="publish">Publish listing</button></form>}
      {["approved","published"].includes(p.status)&&canManage&&<form className="stack-form" action={`/api/admin/properties/${id}/status`} method="post"><label>Revision reason<textarea required name="reason" rows={3}/></label><button className="button button-light" name="action" value="request_changes">Return to owner for changes</button><button className="danger-button" name="action" value="archive" formNoValidate>Archive</button></form>}
      <hr/><h2>Visibility controls</h2><form className="stack-form" action="/api/admin/properties/bulk" method="post"><input type="hidden" name="ids" value={id}/><button name="action" value={p.is_verified?"unverify":"verify"}>{p.is_verified?"Remove verification":"Verify property"}</button><button name="action" value={p.is_featured?"unfeature":"feature"}>{p.is_featured?"Remove feature":"Feature property"}</button><button name="action" value={p.is_pinned?"unpin":"pin"}>{p.is_pinned?"Unpin":"Pin property"}</button></form><p className="form-note">Every action is recorded in the protected audit log.</p>
    </aside></div>
  </div></main>;
}
