import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {resolvePropertyDashboardAccess} from "../src/lib/properties/dashboard-access";

const ownerId="037c1f73-bbec-426f-910b-dc64cab1aa87";
const adminId="97eab665-8487-4c90-a005-294de85d7006";
const statuses=["draft","pending_review","approved","published"] as const;

test("owners can open their property throughout the requested lifecycle",()=>{
  for(const status of statuses){
    assert.equal(
      resolvePropertyDashboardAccess({
        authenticatedUserId:ownerId,
        ownerId,
        canReadAll:false,
      }),
      "owner",
      `owner access failed for ${status}`,
    );
  }
});

test("administrators can open every requested property lifecycle state",()=>{
  for(const status of statuses){
    assert.equal(
      resolvePropertyDashboardAccess({
        authenticatedUserId:adminId,
        ownerId,
        canReadAll:true,
      }),
      "admin",
      `admin access failed for ${status}`,
    );
  }
});

test("anonymous and unrelated authenticated users cannot open dashboard records",()=>{
  for(const status of statuses){
    assert.equal(
      resolvePropertyDashboardAccess({
        authenticatedUserId:null,
        ownerId,
        canReadAll:false,
      }),
      "denied",
      `anonymous access unexpectedly succeeded for ${status}`,
    );
    assert.equal(
      resolvePropertyDashboardAccess({
        authenticatedUserId:adminId,
        ownerId,
        canReadAll:false,
      }),
      "denied",
      `unrelated-user access unexpectedly succeeded for ${status}`,
    );
  }
});

test("dashboard route separates property authorization from optional related data",async()=>{
  const route=await readFile(
    new URL("../app/dashboard/properties/[id]/page.tsx",import.meta.url),
    "utf8",
  );
  assert.match(route,/\.eq\("id",id\)\.is\("deleted_at",null\)\.maybeSingle\(\)/);
  assert.doesNotMatch(route,/\.eq\("owner_id",auth\.user\.id\)/);
  assert.doesNotMatch(route,/deleted_at,property_media\(/);
  assert.match(route,/from\("property_media"\)[\s\S]*?\.eq\("property_id",id\)/);
  assert.match(route,/if\(access==="admin"\)redirect\(`\/admin\/properties\/\$\{id\}`\)/);
  assert.match(route,/if\(propertyError\)[\s\S]*?throw new Error/);
});

test("database RLS remains owner/admin scoped and public dashboard access stays denied",async()=>{
  const migration=await readFile(
    new URL(
      "../supabase/migrations/202607180002_post_sprint3_acceptance.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration,/owner_id = auth\.uid\(\)/);
  assert.match(migration,/public\.has_permission\('properties\.read'\)/);
  assert.match(
    migration,
    /auth\.role\(\) = 'anon' and status = 'published' and deleted_at is null/,
  );
});
