import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("property lifecycle uses draft then pending_review without a parallel approval column",async()=>{
  const[schema,createRoute,submitRoute]=await Promise.all([
    read("../supabase/migrations/202607160001_core_schema.sql"),
    read("../app/api/properties/route.ts"),
    read("../app/api/properties/[id]/submit/route.ts"),
  ]);
  assert.match(schema,/status public\.property_status not null default 'draft'/);
  assert.doesNotMatch(schema,/approval_status/);
  assert.match(createRoute,/status: "draft"/);
  assert.match(submitRoute,/submit_property_for_review/);
  assert.match(submitRoute,/status:"pending_review"/);
});

test("admin property listing includes drafts and filters only when requested",async()=>{
  const page=await read("../app/admin/properties/page.tsx");
  assert.match(page,/const statuses=\["draft","pending_review"/);
  assert.match(page,/if\(statuses\.includes\(params\.status\|\|""\)\)query=query\.eq\("status",params\.status\)/);
  assert.doesNotMatch(page,/from\("properties"\)[\s\S]*?\.eq\("status","pending_review"\)/);
});

test("review decisions require pending_review and property management permission",async()=>{
  const page=await read("../app/admin/properties/[id]/page.tsx");
  assert.match(page,/PERMISSIONS\.propertiesManage/);
  assert.match(page,/p\.status==="pending_review"&&canManage/);
  for(const action of ["approve","request_changes","reject"])assert.match(page,new RegExp(`value="${action}"`));
  assert.match(page,/still a draft.*owner submits it for review/i);
});

test("approval API and RPC enforce permission and valid transitions",async()=>{
  const[route,migration,seed]=await Promise.all([
    read("../app/api/admin/properties/[id]/status/route.ts"),
    read("../supabase/migrations/202607180002_post_sprint3_acceptance.sql"),
    read("../supabase/seed.sql"),
  ]);
  assert.match(route,/supabase\.auth\.getUser\(\)/);
  assert.match(route,/required_permission:"properties\.manage"/);
  assert.match(route,/review_property/);
  assert.match(migration,/if not public\.has_permission\('properties\.manage'\)/);
  assert.match(migration,/review_action = 'approve' and old_status <> 'pending_review'/);
  assert.match(migration,/when 'approve' then 'approved'/);
  assert.match(migration,/approved_by = case when review_action='approve' then auth\.uid\(\)/);
  assert.match(seed,/r\.code = 'super_admin'/);
  assert.match(seed,/property_manager' and p\.code in \('properties\.read','properties\.manage'/);
});
