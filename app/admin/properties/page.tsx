import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNavigation } from "@/src/components/admin-navigation";
import { PropertyDeletionControls } from "@/src/components/admin/property-deletion-controls";
import { BulkActionControls } from "@/src/components/admin/bulk-action-controls";
import { logEvent } from "@/src/lib/observability/logger";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Property administration", robots: { index: false, follow: false } };
const statuses=["draft","pending_review","changes_requested","approved","published","rejected","archived","sold","rented","leased"];
const bulkActions=[["publish","Publish approved"],["archive","Archive (status only)"],["soft_delete","Soft Delete (recoverable)"],["activate","Restore archived / soft-deleted"],["feature","Feature"],["unfeature","Remove feature"],["verify","Mark as Priority Listing"],["unverify","Remove Priority Listing"],["pin","Pin"],["unpin","Unpin"]]as const;
const quickStatuses = [["", "All"], ["pending_review", "Pending"], ["approved", "Approved"], ["published", "Published"], ["rejected", "Rejected"], ["archived", "Archived"]] as const;
type Params = { status?: string; q?: string; owner?: string; transaction?: string; category?: string; type?: string; district?: string; city?: string; locality?: string; verified?: string; featured?: string; contact?: string; map?: string; deleted?: string; from?: string; to?: string; page?: string };

export default async function AdminPropertiesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=/admin/properties");
  const [{ data: allowed },{data:canManage},{data:context}] = await Promise.all([
    supabase.rpc("has_permission",{required_permission:"properties.read"}),
    supabase.rpc("has_permission",{required_permission:"properties.manage"}),
    supabase.rpc("get_current_auth_context")
  ]);
  if (!allowed) redirect("/dashboard");
  const roles=Array.isArray(context?.roles)?context.roles:[],isSuperAdmin=roles.some((role:unknown)=>typeof role==="string"?role==="super_admin":Boolean(role&&typeof role==="object"&&"code" in role&&(role as{code:string}).code==="super_admin"));
  const params = await searchParams, page = Math.max(1, Number(params.page) || 1), size = 20;
  const safe = (value: string) => value.replace(/[%(),]/g, "");
  let query = supabase.from("properties")
    .select("id,reference_no,title,status,transaction_type,locality_text,city_text,district_text,price_inr,submitted_at,updated_at,is_featured,is_verified,is_pinned,is_premium,contact_visibility,deleted_at,profiles!properties_owner_id_fkey(full_name,email,mobile),pg_listings()", { count: "exact" })
    .is("pg_listings", null)
    .order("updated_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  if(statuses.includes(params.status||""))query=query.eq("status",params.status);
  if (params.q) { const q = safe(params.q); query = query.or(`title.ilike.%${q}%,reference_no.ilike.%${q}%`); }
  if (params.owner) {
    const owner = safe(params.owner);
    const { data: owners } = await supabase.from("profiles").select("id").or(`full_name.ilike.%${owner}%,email.ilike.%${owner}%,mobile.ilike.%${owner}%`).limit(200);
    query = query.in("owner_id", (owners || []).map(item => item.id).concat("00000000-0000-0000-0000-000000000000"));
  }
  if (["sale", "rent", "lease"].includes(params.transaction || "")) query = query.eq("transaction_type", params.transaction);
  if (params.category) query = query.contains("details", { category: safe(params.category) });
  if (params.type) query = query.contains("details", { property_type_slug: safe(params.type) });
  if (params.district) query = query.ilike("district_text", `%${safe(params.district)}%`);
  if (params.city) query = query.ilike("city_text", `%${safe(params.city)}%`);
  if (params.locality) query = query.ilike("locality_text", `%${safe(params.locality)}%`);
  if(params.verified==="yes")query=query.eq("is_verified",true);else if(params.verified==="no")query=query.eq("is_verified",false);
  if (params.featured === "yes") query = query.eq("is_featured", true); else if (params.featured === "no") query = query.eq("is_featured", false);
  if (["company", "eligible_members", "public"].includes(params.contact || "")) query = query.eq("contact_visibility", params.contact);
  if (params.map === "yes") query = query.eq("is_premium", true); else if (params.map === "no") query = query.eq("is_premium", false);
  if (params.deleted === "yes") query = query.not("deleted_at", "is", null); else if (params.deleted !== "all" && params.status !== "archived") query = query.is("deleted_at", null);
  if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) query = query.gte("created_at", `${params.from}T00:00:00Z`);
  if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) query = query.lte("created_at", `${params.to}T23:59:59Z`);
  const { data: properties, count, error } = await query;
  if (error) { logEvent("error", "admin.properties_query_failed", { code: error.code }); return <QueryFailure />; }
  const retained = new URLSearchParams(Object.entries(params).filter(([key, value]) => value && key !== "page").map(([key, value]) => [key, String(value)]));
  const pageHref = (target: number) => { const next = new URLSearchParams(retained); next.set("page", String(target)); return `/admin/properties?${next}`; };
  const exportHref = (format: string) => `/api/admin/reports/properties?format=${format}&${retained}`;
  const pages = Math.max(1, Math.ceil((count || 0) / size));
  return <main id="main" className="portal-page admin-portal"><div className="shell">
    <div className="portal-title"><div><p className="eyebrow">Property operations</p><h1>All properties</h1><p>{count || 0} matching ordinary Sale/Rent properties. PG records are managed separately.</p></div></div>
    <AdminNavigation />
    <nav className="admin-status-filters" aria-label="Property status filters">{quickStatuses.map(([value, label]) => <Link key={label} className={(params.status || "") === value ? "active" : ""} href={value ? `/admin/properties?status=${value}` : "/admin/properties"}>{label}</Link>)}</nav>
    <form className="admin-filters admin-filters-expanded">
      <input name="q" defaultValue={params.q} placeholder="Title or reference"/><input name="owner" defaultValue={params.owner} placeholder="Owner name, mobile or email"/>
      <select name="transaction" defaultValue={params.transaction || ""}><option value="">Sale, rent or lease</option><option value="sale">Sale</option><option value="rent">Rent</option><option value="lease">Lease</option></select>
      <select name="status" defaultValue={params.status || ""}><option value="">All statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</select>
      <input name="category" defaultValue={params.category} placeholder="Category slug"/><input name="type" defaultValue={params.type} placeholder="Property type slug"/><input name="district" defaultValue={params.district} placeholder="District"/><input name="city" defaultValue={params.city} placeholder="City"/><input name="locality" defaultValue={params.locality} placeholder="Locality"/>
      <select name="verified" defaultValue={params.verified || ""}><option value="">Any Priority Listing status</option><option value="yes">Priority Listing</option><option value="no">Not a Priority Listing</option></select><select name="featured" defaultValue={params.featured || ""}><option value="">Any feature status</option><option value="yes">Featured</option><option value="no">Not featured</option></select>
      <select name="contact" defaultValue={params.contact || ""}><option value="">Any contact visibility</option><option value="company">Company only</option><option value="eligible_members">Eligible members</option><option value="public">Public owner contact</option></select><select name="map" defaultValue={params.map || ""}><option value="">Any map visibility</option><option value="yes">Exact map enabled</option><option value="no">Locality only</option></select>
      <select name="deleted" defaultValue={params.deleted || ""}><option value="">Active records</option><option value="yes">Soft deleted</option><option value="all">All records</option></select><input type="date" name="from" defaultValue={params.from} aria-label="Created from"/><input type="date" name="to" defaultValue={params.to} aria-label="Created to"/>
      <button className="button button-small">Apply filters</button><Link href="/admin/properties">Clear</Link>
    </form>
    <div className="bulk-toolbar"><Link href={exportHref("csv")}>Export CSV</Link><Link href={exportHref("xlsx")}>Export XLSX</Link></div>
    <BulkActionControls endpoint="/api/admin/properties/bulk" actions={bulkActions} entityLabel="property"><section className="portal-section admin-table-wrap">{properties?.length ? <div className="admin-table property-admin-table"><div className="admin-row admin-head"><span>Select</span><span>Property</span><span>Owner</span><span>Location</span><span>Status</span><span>Flags</span><span/></div>{properties.map(property => { const owner = Array.isArray(property.profiles) ? property.profiles[0] : property.profiles; return <div className="admin-row" key={property.id}>
      <span><input data-bulk-id="true" data-reference={property.reference_no} data-title={property.title} data-deleted={Boolean(property.deleted_at)} type="checkbox" value={property.id} aria-label={`Select ${property.reference_no}`}/></span><span><strong>{property.title}</strong><small>{property.reference_no} · {property.transaction_type}</small></span><span>{owner?.full_name || "—"}<small>{owner?.mobile || owner?.email}</small></span><span>{property.locality_text}, {property.city_text}</span><span><i className={`status status-${property.status}`}>{property.status.replaceAll("_", " ")}</i></span>
      <span className="flag-list">{property.is_verified && <b>Priority Listing</b>}{property.is_featured && <b>Featured</b>}{property.is_pinned && <b>Pinned</b>}{property.is_premium && <b>Map</b>}<b>{property.contact_visibility}</b>{property.deleted_at && <b>Deleted</b>}</span><span><Link href={`/admin/properties/${property.id}`}>Manage →</Link>{canManage&&<PropertyDeletionControls id={property.id} reference={property.reference_no} title={property.title} deleted={Boolean(property.deleted_at)} allowPermanent={isSuperAdmin} compact />}</span>
    </div>; })}</div> : <div className="empty-state"><h2>No matching properties</h2></div>}</section></BulkActionControls>
    <nav className="pagination">{page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={pageHref(page + 1)}>Next</Link>}</nav>
  </div></main>;
}

function QueryFailure() { return <main id="main" className="portal-page admin-portal"><div className="shell"><AdminNavigation/><div className="config-warning" role="alert"><h1>Properties could not be loaded</h1><p>Retry this page. If the problem continues, contact support with the request ID.</p><Link className="button" href="/admin/properties">Retry</Link></div></div></main>; }
