import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");
const migration=()=>read("../supabase/migrations/202609140001_owner_enquiry_entitlement.sql");

test("free owner receives only a total and location-wise aggregate",async()=>{
  const[sql,page]=await Promise.all([migration(),read("../app/dashboard/enquiries/page.tsx")]);
  const summary=sql.match(/create or replace function public\.get_my_enquiry_summary\(\)[\s\S]*?\$\$;/i)?.[0]||"";
  assert.match(summary,/where p\.owner_id=auth\.uid\(\)/);
  assert.match(summary,/join public\.properties p on p\.id=e\.property_id/);
  assert.match(summary,/group by p\.locality_text,p\.city_text/);
  assert.match(summary,/'total',coalesce\(sum\(enquiry_count\),0\)/);
  assert.match(summary,/'locations',coalesce\(jsonb_agg/);
  assert.doesNotMatch(summary,/e\.(?:name|mobile|email|message|attribution|user_agent)/);
  assert.match(page,/supabase\.rpc\("get_my_enquiry_summary"\)/);
  assert.match(page,/Total enquiries/);
  assert.match(page,/Enquiries by location/);
});

test("free owner cannot fetch enquiry identity or contact fields directly",async()=>{
  const sql=await migration();
  const policy=sql.match(/create policy enquiry_owner_read[\s\S]*?\);/i)?.[0]||"";
  assert.match(sql,/drop policy if exists enquiry_owner_read on public\.enquiries/);
  assert.match(policy,/public\.has_my_paid_enquiry_access\(\)/);
  assert.match(policy,/p\.owner_id=auth\.uid\(\)/);
  assert.match(sql,/revoke all on function public\.get_my_enquiry_summary\(\) from public,anon/);
  assert.match(sql,/grant execute on function public\.get_my_enquiry_summary\(\) to authenticated/);
});

test("paid eligibility uses active non-free subscription with enquiry access",async()=>{
  const sql=await migration();
  const access=sql.match(/create or replace function public\.has_my_paid_enquiry_access\(\)[\s\S]*?\$\$;/i)?.[0]||"";
  assert.match(access,/public\.subscriptions s/);
  assert.match(access,/join public\.plans plan on plan\.id=s\.plan_id/);
  assert.match(access,/s\.status='active'/);
  assert.match(access,/s\.starts_at<=now\(\) and s\.ends_at>now\(\)/);
  assert.match(access,/plan\.enquiry_access and plan\.slug<>'free'/);
  assert.match(sql,/grant execute on function public\.has_my_paid_enquiry_access\(\) to authenticated/);
});

test("paid owners retain full details, while free page branch never queries PII",async()=>{
  const page=await read("../app/dashboard/enquiries/page.tsx");
  const freeStart=page.indexOf("if(paid!==true&&admin!==true)"),paidStart=page.indexOf('supabase.from("enquiries")');
  assert.ok(freeStart>=0&&paidStart>freeStart);
  assert.doesNotMatch(page.slice(freeStart,paidStart),/supabase\.from\("enquiries"\)|\.name\}|\.mobile\}|\.email\}|\.message\}/);
  assert.match(page.slice(paidStart),/select\("id,reference_no,name,mobile,email,message,status,created_at,property_id"\)/);
});

test("free export cannot leak contacts; admin export and CRM access remain intact",async()=>{
  const[adminExport,ownerExport,adminPage,sql]=await Promise.all([read("../app/api/admin/reports/[entity]/route.ts"),read("../app/api/dashboard/reports/[entity]/route.ts"),read("../app/admin/enquiries/page.tsx"),migration()]);
  assert.match(adminExport,/enquiries:\{permission:"enquiries.read"/);
  assert.match(adminExport,/required_permission:"reports.read"/);
  assert.match(adminExport,/required_permission:config.permission/);
  assert.match(ownerExport,/if\(entity!=="analytics"\)return/);
  assert.match(adminPage,/required_permission:"enquiries.read"/);
  assert.doesNotMatch(sql,/drop policy if exists enquiry_admin_read|revoke .*enquiries.*from authenticated/);
});
