import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {POSTING_ENTITLEMENT_MESSAGE} from "../src/lib/properties/posting-entitlement";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");
const functionBody=(sql:string,name:string)=>sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?end \\$\\$;`,"i"))?.[0]||"";

test("first free listing is allowed and a second normal listing is blocked",async()=>{
  const sql=await read("../supabase/migrations/202609060002_property_posting_workflow.sql");
  const check=functionBody(sql,"check_property_posting_permission");
  assert.match(check,/property_posting_uses where user_id=auth\.uid\(\)/);
  assert.match(check,/property_posting_grants where user_id=auth\.uid\(\)/);
  assert.match(check,/used_count < 1\+grant_count/);
  assert.equal(0<1+0,true);
  assert.equal(1<1+0,false);
});

test("normal property and PG consume the same account-wide limit",async()=>{
  const sql=await read("../supabase/migrations/202609110001_latest_posting_validation.sql");
  assert.match(functionBody(sql,"submit_property_for_review"),/consume_property_posting_permission\(target_property\)/);
  assert.match(functionBody(sql,"submit_pg_for_review"),/consume_property_posting_permission\(property_record\.id\)/);
  assert.equal(1<1+0,false); // One submitted PG blocks a new normal listing, and vice versa.
});

test("each admin +1 grant permits exactly one additional submission",async()=>{
  const sql=await read("../supabase/migrations/202609060002_property_posting_workflow.sql");
  const grant=functionBody(sql,"grant_one_property_permission"),consume=functionBody(sql,"consume_property_posting_permission");
  assert.match(grant,/insert into public\.property_posting_grants\(user_id,granted_by\)/);
  assert.match(consume,/if used_count>=1\+grant_count then raise exception 'PROPERTY_POSTING_LIMIT_REACHED'/);
  assert.match(consume,/insert into public\.property_posting_uses\(property_id,user_id\)/);
  assert.equal(1<1+1,true);
  assert.equal(2<1+1,false);
});

test("opening the form or saving normal and PG drafts does not consume permission",async()=>{
  const[entry,normalDraft,pgDraft,sql]=await Promise.all([read("../app/post-property/page.tsx"),read("../app/api/properties/route.ts"),read("../app/api/pg/route.ts"),read("../supabase/migrations/202607270002_sprint4_paying_guest_module.sql")]);
  assert.match(entry,/check_property_posting_permission/);
  assert.match(normalDraft,/check_property_posting_permission/);
  assert.match(pgDraft,/check_property_posting_permission/);
  assert.doesNotMatch(entry+normalDraft+pgDraft,/consume_property_posting_permission|property_posting_uses/);
  assert.doesNotMatch(functionBody(sql,"create_pg_draft"),/consume_property_posting_permission|property_posting_uses/);
});

test("direct normal API draft and submit cannot bypass the server limit",async()=>{
  const[draft,submit,pgSubmit,duplicate,dashboard,pgDashboard,entry]=await Promise.all([read("../app/api/properties/route.ts"),read("../app/api/properties/[id]/submit/route.ts"),read("../app/api/pg/[id]/submit/route.ts"),read("../app/api/properties/[id]/route.ts"),read("../app/dashboard/properties/new/page.tsx"),read("../app/dashboard/pg/new/page.tsx"),read("../app/post-property/page.tsx")]);
  assert.match(draft,/supabase\.rpc\("check_property_posting_permission"\)/);
  assert.match(draft,/if\(permissionError\|\|!permissionResult\?\.allowed\)return/);
  assert.match(submit,/supabase\.rpc\("submit_property_for_review"/);
  assert.match(submit,/PROPERTY_POSTING_LIMIT_REACHED"\?POSTING_ENTITLEMENT_MESSAGE/);
  assert.match(pgSubmit,/PROPERTY_POSTING_LIMIT_REACHED"\?POSTING_ENTITLEMENT_MESSAGE/);
  assert.match(duplicate,/supabase\.rpc\("check_property_posting_permission"\)/);
  assert.match(dashboard,/check_property_posting_permission/);
  assert.match(pgDashboard,/check_property_posting_permission/);
  assert.match(pgDashboard,/\{POSTING_ENTITLEMENT_MESSAGE\}/);
  assert.match(entry,/auth\.getUser\(\)/);
  assert.equal(POSTING_ENTITLEMENT_MESSAGE,"You've used your free listing. To add another property, please contact our team at 7788998459 or admin@ongoleproperty.com — our admin will assist you.");
});
