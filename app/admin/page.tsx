import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin dashboard", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!env.isSupabaseConfigured) return <main id="main" className="portal-page"><div className="shell"><div className="config-warning"><h1>Admin configuration pending</h1><p>Apply the Supabase migrations and promote the first user using the documented seed instruction.</p></div></div></main>;
  const supabase = await createSupabaseServerClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) redirect("/login?returnTo=/admin");
  const { data: allowed } = await supabase.rpc("has_permission",{ required_permission:"properties.read" }); if (!allowed) redirect("/dashboard");
  const [pending, published, enquiries, users] = await Promise.all([supabase.from("properties").select("id",{ count:"exact",head:true }).eq("status","pending_review"),supabase.from("properties").select("id",{ count:"exact",head:true }).eq("status","published"),supabase.from("enquiries").select("id",{ count:"exact",head:true }).eq("status","new"),supabase.from("profiles").select("id",{ count:"exact",head:true })]);
  const modules = [["Property approvals",pending.count ?? 0,"Awaiting review"],["Published properties",published.count ?? 0,"Live inventory"],["New enquiries",enquiries.count ?? 0,"Needs response"],["Registered users",users.count ?? 0,"Platform accounts"]];
  return <main id="main" className="portal-page admin-portal"><div className="shell"><div className="portal-title"><div><p className="eyebrow">Secure administration</p><h1>Operations overview</h1><p>Role-based access is enforced on the server and in PostgreSQL RLS.</p></div><div className="portal-actions"><Link className="button button-light" href="/dashboard">Member dashboard</Link><form action="/api/auth/logout" method="post"><button className="text-button" type="submit">Sign out</button></form></div></div><section className="metric-grid">{modules.map(([title,value,note]) => <article key={String(title)}><span>{note}</span><strong>{value}</strong><h2>{title}</h2></article>)}</section><section className="portal-section"><p className="eyebrow">Operational queue</p><h2>Property approval workspace</h2><p>Review submitted information, require corrections, approve and publish through a transaction-safe audited workflow.</p><Link className="button" href="/admin/properties">Open approval queue</Link></section></div></main>;
}
