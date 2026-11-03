import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("public visitor tracking uses the protected existing analytics pipeline",async()=>{
  const[client,route]=await Promise.all([read("../src/components/public-page-analytics.tsx"),read("../app/api/analytics/events/route.ts")]);
  assert.match(client,/send\("page_view"\)/);
  assert.match(client,/privatePath\.test\(pathname\)/);
  assert.match(route,/x-vercel-ip-city/);
  assert.match(route,/sessionHash/);
  assert.doesNotMatch(route,/latitude|longitude|gps/i);
});

test("visitor summaries remain admin-only and expose date and approximate location counts",async()=>{
  const[migration,page]=await Promise.all([read("../supabase/migrations/202610070001_visitor_analytics.sql"),read("../app/admin/analytics/page.tsx")]);
  for(const marker of ["get_visitor_analytics","has_permission('analytics.read')","count(distinct session_hash)","by_day","by_location","revoke all"])assert.ok(migration.includes(marker),`missing visitor analytics guard ${marker}`);
  for(const marker of ["Total visitors","Total page views","Visitors by date","Visitors by approximate location","/admin/analytics"])assert.ok(page.includes(marker),`missing analytics UI ${marker}`);
});
