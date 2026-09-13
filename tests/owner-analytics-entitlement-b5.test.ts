import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("free owner receives safe aggregate analytics and B4 enquiry summaries",async()=>{
  const page=await read("../app/dashboard/analytics/page.tsx");
  assert.match(page,/select\("day,entity_id,event_type,event_count"\)/);
  assert.match(page,/supabase\.rpc\("get_my_enquiry_summary"\)/);
  assert.match(page,/Listing views/);
  assert.match(page,/Enquiries by location/);
  assert.match(page,/Number\(summary\?\.total\|\|0\)/);
  assert.match(page,/paid===true\|\|admin===true/);
});

test("analytics page and export request only aggregate fields and no enquiry PII",async()=>{
  const[page,report]=await Promise.all([read("../app/dashboard/analytics/page.tsx"),read("../app/api/dashboard/reports/[entity]/route.ts")]);
  assert.doesNotMatch(page,/from\("enquiries"\)|select\("[^"]*(?:name|mobile|email|whatsapp|contact_)/i);
  assert.doesNotMatch(report,/from\("enquiries"\)|select\("[^"]*(?:name|mobile|email|whatsapp|contact_|metadata)/i);
  assert.match(report,/columns=\["day","entity_type","entity_id","event_type","event_count"\]/);
});

test("direct analytics export cannot bypass B4 eligibility",async()=>{
  const report=await read("../app/api/dashboard/reports/[entity]/route.ts");
  assert.match(report,/supabase\.rpc\("has_my_paid_enquiry_access"\)/);
  assert.match(report,/if\(paid!==true&&admin!==true\)return NextResponse\.json\(\{error:"Eligible membership required\."\},\{status:403\}\)/);
  assert.doesNotMatch(report,/get_my_plan_context|analytics_access/);
});

test("paid eligible owners retain detailed analytics and exports",async()=>{
  const[page,report]=await Promise.all([read("../app/dashboard/analytics/page.tsx"),read("../app/api/dashboard/reports/[entity]/route.ts")]);
  assert.match(page,/detailed&&<section/);
  assert.match(page,/Listing performance/);
  assert.match(page,/detailed\?<><a[^>]+reports\/analytics\?format=csv/);
  assert.match(report,/paid!==true&&admin!==true/);
});

test("admin access remains permission-based",async()=>{
  const[page,report,admin]=await Promise.all([read("../app/dashboard/analytics/page.tsx"),read("../app/api/dashboard/reports/[entity]/route.ts"),read("../app/admin/analytics/page.tsx")]);
  assert.match(page,/required_permission:"analytics.read"/);
  assert.match(report,/required_permission:"analytics.read"/);
  assert.match(admin,/required_permission:"analytics.read"/);
});

test("B4 enquiry row and aggregate protections remain intact",async()=>{
  const sql=await read("../supabase/migrations/202609140001_owner_enquiry_entitlement.sql");
  assert.match(sql,/create policy enquiry_owner_read[\s\S]*public\.has_my_paid_enquiry_access\(\)/);
  assert.match(sql,/where p\.id=enquiries\.property_id and p\.owner_id=auth\.uid\(\)/);
  assert.match(sql,/create or replace function public\.get_my_enquiry_summary\(\)/);
  assert.doesNotMatch(sql.match(/create or replace function public\.get_my_enquiry_summary\(\)[\s\S]*?\$\$;/i)?.[0]||"",/e\.(?:name|mobile|email|message|attribution|user_agent)/);
});
