import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNavigation } from "@/src/components/admin-navigation";
import { PendingLink as Link } from "@/src/components/pending-link";
import { FormPendingStatus, PendingSubmitButton } from "@/src/components/pending-submit-button";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users and owners", robots: { index: false, follow: false } };
const types = ["buyer", "owner", "agent", "pg_owner", "admin"], statuses = ["pending", "active", "suspended", "blocked"];
type Params = { q?: string; accountType?: string; status?: string; verified?: string; hasListings?: string; page?: string };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Params> }) {
  const supabase = await createSupabaseServerClient(), { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?returnTo=/admin/users");
  const { data: allowed } = await supabase.rpc("has_permission", { required_permission: "users.read" });
  if (!allowed) redirect("/admin");
  const params = await searchParams, page = Math.max(1, Number(params.page) || 1), size = 25;
  let ownerIds: string[] | null = null;
  if (params.hasListings === "yes") {
    const { data: ownerRows } = await supabase.from("properties").select("owner_id,pg_listings()").is("deleted_at", null).is("pg_listings", null);
    ownerIds = [...new Set((ownerRows || []).map(row => row.owner_id))];
  }
  // Roles are intentionally loaded only on the user detail page. Nesting the
  // protected role tables here makes the entire profile query fail for Admins
  // who may read users but may not manage roles.
  let query = supabase.from("profiles").select("id,reference_no,full_name,email,mobile,account_type,status,email_verified,mobile_verified,created_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  if (ownerIds) query = query.in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
  if (types.includes(params.accountType || "")) query = query.eq("account_type", params.accountType);
  if (statuses.includes(params.status || "")) query = query.eq("status", params.status);
  if (params.verified === "email") query = query.eq("email_verified", true); else if (params.verified === "mobile") query = query.eq("mobile_verified", true);
  if (params.q) { const q = params.q.replace(/[%(),]/g, ""); query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,mobile.ilike.%${q}%,reference_no.ilike.%${q}%`); }
  const { data: users, count, error } = await query;
  const ids = (users || []).map(item => item.id);
  const { data: listings } = ids.length ? await supabase.from("properties").select("owner_id,pg_listings()").in("owner_id", ids).is("deleted_at", null).is("pg_listings", null) : { data: [] };
  const counts = new Map<string, number>(); for (const item of listings || []) counts.set(item.owner_id, (counts.get(item.owner_id) || 0) + 1);
  const clean = new URLSearchParams(Object.entries(params).filter(([, value]) => value).map(([key, value]) => [key, String(value)]));
  const pageHref = (target: number) => { const next = new URLSearchParams(clean); next.set("page", String(target)); return `/admin/users?${next}`; };
  const pages = Math.max(1, Math.ceil((count || 0) / size));
  return <main id="main" className="portal-page admin-portal"><div className="shell">
    <div className="portal-title"><div><p className="eyebrow">Identity operations</p><h1>{params.hasListings === "yes" ? "Users & owners with listings" : "Users and owners"}</h1><p>{count || 0} accounts match this view. Owner status is based on actual listing ownership, not a stale profile label.</p></div></div><AdminNavigation/>
    <form className="admin-filters">{params.hasListings === "yes" && <input type="hidden" name="hasListings" value="yes"/>}<input name="q" defaultValue={params.q} placeholder="Name, email, mobile or reference"/><select name="accountType" defaultValue={params.accountType || ""}><option value="">All account types</option>{types.map(value => <option key={value}>{value}</option>)}</select><select name="status" defaultValue={params.status || ""}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select><select name="verified" defaultValue={params.verified || ""}><option value="">Any verification</option><option value="email">Email verified</option><option value="mobile">Mobile verified</option></select><PendingSubmitButton className="button button-small" pendingText="Searching…">Search</PendingSubmitButton><FormPendingStatus message="Updating users…"/></form>
    <div className="bulk-toolbar"><Link href="/api/admin/reports/users?format=csv">Export CSV</Link><Link href="/api/admin/reports/users?format=xlsx">Export XLSX</Link></div>
    <section className="portal-section admin-table-wrap">{error ? <p className="form-message error">Users could not be loaded.</p> : users?.length ? <div className="admin-table user-admin-table"><div className="admin-row admin-head"><span>User</span><span>Contact</span><span>Type</span><span>Verification</span><span>Listings</span><span>Status</span><span/></div>{users.map(user => <div className="admin-row" key={user.id}><span><strong>{user.full_name || "Unnamed user"}</strong><small>{user.reference_no}<br/>{new Date(user.created_at).toLocaleDateString("en-IN")}</small></span><span>{user.email || "—"}<small>{user.mobile || "No mobile"}</small></span><span>{user.account_type}</span><span>{user.email_verified ? "Email ✓" : "Email pending"}<small>{user.mobile_verified ? "Mobile ✓" : "Mobile pending"}</small></span><span>{counts.get(user.id) || 0}</span><span><i className={`status status-${user.status}`}>{user.status}</i></span><span><Link href={`/admin/users/${user.id}`}>Manage →</Link></span></div>)}</div> : <div className="empty-state"><h2>No matching users</h2></div>}</section>
    <nav className="pagination">{page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={pageHref(page + 1)}>Next</Link>}</nav>
  </div></main>;
}
