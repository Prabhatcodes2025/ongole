import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pgDraftSchema, pgRoomSchema } from "../src/lib/pg/validation";
import { propertyPriceError } from "../src/lib/properties/validation";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("ordinary Admin property queues exclude PG backing records and expose safe deletion", async () => {
  const [list, detail, control, route, bulk] = await Promise.all([
    read("../app/admin/properties/page.tsx"), read("../app/admin/properties/[id]/page.tsx"),
    read("../src/components/admin/property-deletion-controls.tsx"), read("../app/api/admin/properties/[id]/deletion/route.ts"),
    read("../app/api/admin/properties/bulk/route.ts")
  ]);
  assert.match(list, /pg_listings\(\)/); assert.match(list, /\.is\("pg_listings", null\)/);
  assert.match(detail, /pg_listings\(id\)/); assert.match(detail, /p\.pg_listings/);
  for (const label of ["All", "Pending", "Approved", "Published", "Rejected", "Archived"]) assert.ok(list.includes(label));
  assert.match(list, /PropertyDeletionControls/); assert.match(detail, /PropertyDeletionControls/);
  assert.match(control, /Type <strong>\{reference\}<\/strong> to confirm/);
  assert.match(control, /DELETE \{reference\}/); assert.match(control, /allowPermanent&&deleted/);
  assert.match(route, /admin_manage_property_deletion/); assert.match(route, /pg_listings\(id\)/); assert.match(route, /property\.pg_listings/);
  assert.doesNotMatch(bulk, /"delete"/);
});

test("deletion migration is atomic, audited, RBAC protected and retention aware", async () => {
  const sql = await read("../supabase/migrations/202610200001_admin_property_deletion_visibility.sql");
  assert.match(sql, /^--[^\n]+\nbegin;/); assert.match(sql, /commit;\s*$/);
  assert.match(sql, /end;\s*\$\$;/, "the PL/pgSQL block must terminate inside the dollar-quoted body");
  assert.match(sql, /has_permission\('properties\.manage'\)/);
  assert.match(sql, /role\.code='super_admin'/);
  assert.match(sql, /confirmation_mismatch/); assert.match(sql, /pg_workflow_required/);
  assert.match(sql, /exists\(select 1 from public\.pg_listings where property_id=target_property\)/);
  for (const table of ["enquiries", "promotion_activations", "property_posting_uses"]) assert.match(sql, new RegExp(`exists\\(select 1 from public\\.${table}`));
  for (const action of ["property.soft_delete", "property.restore", "property.permanent_delete"]) assert.ok(sql.includes(action));
  assert.match(sql, /where id=target_property/);
  assert.doesNotMatch(sql, /\b(?:drop table|truncate|disable row level security)\b/i);
  assert.doesNotMatch(sql, /update\s+public\.profiles/i, "existing profiles must not be overwritten");
  assert.match(sql, /not exists\(select 1 from public\.profiles existing where existing\.id=auth_user\.id\)/);
});

test("owner and agent discovery are complete and paginated", async () => {
  const [owners, users, agents, overview] = await Promise.all([read("../app/admin/owners/page.tsx"), read("../app/admin/users/page.tsx"), read("../app/admin/agents/page.tsx"), read("../app/admin/page.tsx")]);
  assert.match(owners, /hasListings/); assert.doesNotMatch(owners, /accountType.*owner/);
  assert.match(users, /select\("owner_id,pg_listings\(\)"\)[\s\S]*is\("deleted_at", null\)[\s\S]*is\("pg_listings", null\)/);
  assert.doesNotMatch(agents, /profiles!inner/); assert.match(agents, /count: "exact"/); assert.match(agents, /\.range\(\(page - 1\) \* size, page \* size - 1\)/);
  assert.match(overview, /Registered agents/); assert.match(overview, /Pending agents/);
  assert.match(overview, /new Set\(\(ownerRows\.data/);
});

test("Admin counts and ordinary public queries use the PG relationship, not JSON metadata", async () => {
  const [overview, list, users, detail, route, publicQueries] = await Promise.all([
    read("../app/admin/page.tsx"), read("../app/admin/properties/page.tsx"), read("../app/admin/users/page.tsx"),
    read("../app/admin/properties/[id]/page.tsx"), read("../app/api/admin/properties/[id]/deletion/route.ts"), read("../src/lib/properties/public.ts")
  ]);
  for (const source of [overview, list, users, detail, route]) assert.doesNotMatch(source, /listing_kind/);
  assert.ok((overview.match(/\.is\("pg_listings", null\)/g) || []).length >= 5, "all ordinary Admin counts must anti-join PG rows");
  assert.match(overview, /select\("id,pg_listings\(\)", \{ count: "exact", head: true \}\)/);
  assert.match(publicQueries, /from\("pg_listings"\)\.select\("property_id"\)/);
  assert.ok((publicQueries.match(/pgPropertyIds\.has\(String\(/g) || []).length >= 3, "list, detail and sitemap results must exclude PG relationship IDs");
  assert.match(publicQueries, /if\(!pgPropertyIds\)return/);
  assert.doesNotMatch(publicQueries, /listing_kind/);
});

test("owner counts promotions and property alerts classify PG rows by relationship", async () => {
  const sources = await Promise.all([
    read("../app/dashboard/page.tsx"), read("../app/dashboard/properties/page.tsx"),
    read("../app/dashboard/promotions/page.tsx"), read("../src/lib/property-alerts/dispatch.ts")
  ]);
  for (const source of sources) { assert.doesNotMatch(source, /listing_kind/); assert.match(source, /pg_listings\(id\)/); }
  assert.match(sources[1], /\.is\("pg_listings",null\)/);
});

test("new submissions reject implausible prices while retaining valid boundaries", () => {
  assert.ok(propertyPriceError(3, "sale")); assert.ok(propertyPriceError(3, "rent"));
  assert.equal(propertyPriceError(1000, "sale"), null); assert.equal(propertyPriceError(100, "rent"), null);
  const base = { pg_name: "Sunrise Womens Hostel", category: "womens" as const, description: "A clean and professionally managed paying guest residence.", locality: "Ongole", city: "Ongole", district: "Prakasam", state: "Andhra Pradesh", rent_basis: "per_bed_month" as const, amenities: [], house_rules: [], video_urls: [], consent: "true" as const };
  assert.equal(pgDraftSchema.safeParse({ ...base, rent_per_bed: 3 }).success, false);
  assert.equal(pgDraftSchema.safeParse({ ...base, rent_per_bed: 100 }).success, true);
  assert.equal(pgRoomSchema.safeParse({ name: "Single room", sharing_type: "single", capacity: 1, available_beds: 1, monthly_rent: 3 }).success, false);
});
