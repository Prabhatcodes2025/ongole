import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage property", robots: { index: false, follow: false } };

const mediaMessages: Record<string, string> = {
  uploaded: "Image uploaded, converted to WebP and watermarked.",
  invalid: "Choose a JPG, PNG or WebP image up to 15 MB.",
  limit: "A property can have up to 20 images.",
  failed: "The image could not be processed. Please try another file.",
};

export default async function ManagePropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ media?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?returnTo=/dashboard/properties/${id}`);
  const { data: property } = await supabase.from("properties").select("id,reference_no,title,status,description,locality_text,city_text,price_inr,area_value,area_unit,details,submitted_at,updated_at,property_media(id,original_filename,processing_status,is_cover,sort_order)").eq("id", id).eq("owner_id", auth.user.id).single();
  if (!property) notFound();
  const editable = ["draft", "changes_requested"].includes(property.status);
  const mediaNotice = mediaMessages[query.media || ""];

  return <main id="main" className="portal-page"><div className="shell">
    <nav className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span>›</span><span>{property.reference_no}</span></nav>
    <div className="portal-title"><div><p className="eyebrow">{property.reference_no}</p><h1>{property.title}</h1><p><span className={`status status-${property.status}`}>{property.status.replaceAll("_", " ")}</span> · Updated {new Date(property.updated_at).toLocaleDateString("en-IN")}</p></div>{editable && <form action={`/api/properties/${id}/submit`} method="post"><button className="button" type="submit">Submit for review</button></form>}</div>
    {mediaNotice && <p className={`form-message ${query.media === "uploaded" ? "success" : "error"}`} role="status">{mediaNotice}</p>}
    <div className="review-layout"><section className="portal-section">
      <h2>Property draft</h2>
      <dl className="review-facts"><div><dt>Location</dt><dd>{property.locality_text}, {property.city_text}</dd></div><div><dt>Price</dt><dd>₹{Number(property.price_inr || 0).toLocaleString("en-IN")}</dd></div><div><dt>Area</dt><dd>{property.area_value} {property.area_unit}</dd></div><div className="wide"><dt>Description</dt><dd>{property.description}</dd></div></dl>
      <div className="section-heading-row"><h2>Property media</h2><span>{property.property_media?.length || 0}/20 images</span></div>
      {editable && <form className="media-upload" action={`/api/properties/${id}/media`} method="post" encType="multipart/form-data"><label>Upload property image<input required type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label><button className="button secondary" type="submit">Process &amp; upload</button><p className="form-note">JPG, PNG or WebP, up to 15 MB. Images are resized, converted to WebP and watermarked automatically.</p></form>}
      {property.property_media?.length ? <ul className="media-list">{property.property_media.map((media) => <li key={media.id}><span>{media.original_filename}{media.is_cover ? " · Cover" : ""}</span><span className={`status status-${media.processing_status}`}>{media.processing_status}</span></li>)}</ul> : <div className="empty-state compact"><h3>No images uploaded</h3><p>Add clear exterior, interior and location images before submitting for review.</p></div>}
    </section><aside className="review-actions"><p className="eyebrow">Workflow</p><h2>{editable ? "Complete the draft" : "Submission is locked"}</h2><p>{editable ? "Review all information and media before submitting. Once submitted, editing is locked until an administrator requests changes." : "An administrator is reviewing this record. Status changes are logged and you will be notified when action is required."}</p><Link className="arrow-link" href="/dashboard">Back to dashboard →</Link></aside></div>
  </div></main>;
}
