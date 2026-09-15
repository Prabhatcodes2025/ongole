import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {matchesPropertyAlert,propertyAlertPath,type AlertRequirement,type MatchableProperty} from "../src/lib/property-alerts/matching";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");
const property:MatchableProperty={id:"p1",transaction_type:"sale",category_slug:"residential",property_type_slug:"apartment-flat",locality:"Bhagyanagar",city:"Ongole",district:"Prakasam",price:4_500_000,area_sq_ft:1200,bedrooms:2,status:"published"};
const alert:AlertRequirement={id:"a1",user_id:"u1",transaction_type:"sale",category_slug:"residential",property_type_slug:"apartment-flat",locations:["Bhagyanagar","Ongole"],min_budget:4_000_000,max_budget:5_000_000,min_area_sq_ft:1000,max_area_sq_ft:1500,bedrooms:2,active:true};

test("deterministic matching supports every Phase-1 criterion and optional wildcards",()=>{
  assert.equal(matchesPropertyAlert(property,alert),true);
  for(const patch of [{transaction_type:"rent"},{category_slug:"commercial"},{property_type_slug:"villa"},{locations:["Kandukur"]},{min_budget:4_600_000},{max_budget:4_400_000},{min_area_sq_ft:1300},{max_area_sq_ft:1100},{bedrooms:3},{active:false}])assert.equal(matchesPropertyAlert(property,{...alert,...patch} as AlertRequirement),false);
  assert.equal(matchesPropertyAlert(property,{...alert,category_slug:null,property_type_slug:null,locations:[],min_budget:null,max_budget:null,min_area_sq_ft:null,max_area_sq_ft:null,bedrooms:null}),true);
  assert.equal(matchesPropertyAlert({...property,status:"approved"},alert),false);
});

test("notification paths are exact internal public-detail paths",()=>{
  assert.equal(propertyAlertPath("two-bhk-bhagyanagar",false),"/property/two-bhk-bhagyanagar");
  assert.equal(propertyAlertPath("safe-pg",true),"/paying-guest/safe-pg");
  assert.equal(propertyAlertPath("//evil.example",false),null);
});

test("migration provides owner RLS, private registrations and first-publish dedupe",async()=>{
  const sql=await read("../supabase/migrations/202609150001_property_smart_push_phase1.sql");
  for(const table of ["property_alert_preferences","property_alert_requirements","push_registrations","push_publish_jobs","push_notification_logs"])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql,/using \(user_id=auth\.uid\(\)\)/);assert.match(sql,/grant select on public\.push_registrations/);assert.doesNotMatch(sql,/grant (insert|update|delete).*push_registrations.*authenticated/);
  assert.match(sql,/old\.status <> 'published'[\s\S]*new\.status = 'published'/);assert.match(sql,/old\.published_at is null/);assert.match(sql,/property_id uuid not null unique/);assert.match(sql,/dedupe_key text not null unique/);
  assert.match(sql,/security definer set search_path=public,pg_temp/);assert.match(sql,/revoke all on function public\.enqueue_first_property_push\(\) from public,anon,authenticated/);
});

test("user and Admin APIs enforce identity, ownership, origin, RBAC, rate limits and confirmation",async()=>{
  const [user,registration,admin]=await Promise.all([read("../app/api/property-alerts/route.ts"),read("../app/api/property-alerts/registration/route.ts"),read("../app/api/admin/push-notifications/route.ts")]);
  for(const source of [user,registration,admin]){assert.match(source,/getUser\(\)/);assert.match(source,/request\.headers\.get\("origin"\)/);assert.match(source,/checkRateLimit/)}
  assert.match(user,/\.eq\("user_id",user\.id\)/);assert.match(user,/count[\s\S]*>=20/);assert.match(registration,/createSupabaseServiceClient/);assert.match(registration,/\.eq\("user_id",user\.id\)/);assert.match(admin,/notifications\.manage/);assert.match(admin,/SEND PUSH/);assert.match(admin,/record_audit_event/);
});

test("delivery rechecks enabled, paused, registration and property state and suppresses duplicates",async()=>{
  const source=await read("../src/lib/property-alerts/dispatch.ts");
  for(const marker of ["permission_status","requirement.data?.active","registration.data?.active","property.data?.status","no_longer_eligible","invalid_registration","limitPerUser=3","onConflict:\"dedupe_key\""])assert.match(source,new RegExp(marker.replace(/[?.]/g,"\\$&")));
  assert.match(source,/limit\(batchSize\)/);assert.match(source,/limit\(10\)/);assert.match(source,/firebaseAdminConfigured\(\)/);
});

test("permission prompt is user initiated, supports multiple devices, and secrets stay server-only",async()=>{
  const [client,server,worker,env]=await Promise.all([read("../src/components/property-alerts/push-opt-in.tsx"),read("../src/lib/property-alerts/firebase-admin.ts"),read("../app/firebase-messaging-sw.js/route.ts"),read("../.env.example")]);
  assert.match(client,/onClick=\{enable\}/);assert.match(client,/Notification\.requestPermission\(\)/);assert.match(client,/crypto\.randomUUID\(\)/);assert.match(client,/getToken/);assert.match(client,/delete|disable/);
  assert.match(worker,/onBackgroundMessage/);assert.match(worker,/notificationclick/);assert.match(worker,/safePath/);assert.match(server,/FIREBASE_PRIVATE_KEY/);assert.doesNotMatch(client,/FIREBASE_PRIVATE_KEY|FIREBASE_CLIENT_EMAIL/);
  assert.match(env,/NEXT_PUBLIC_FIREBASE_VAPID_KEY=/);assert.match(env,/FIREBASE_PRIVATE_KEY=/);assert.doesNotMatch(env,/NEXT_PUBLIC_FIREBASE_PRIVATE_KEY/);
});

test("publish integrations and cron process durable database work",async()=>{
  const [propertyRoute,pgRoute,bulk,cron]=await Promise.all([read("../app/api/admin/properties/[id]/status/route.ts"),read("../app/api/admin/pg/[id]/status/route.ts"),read("../app/api/admin/properties/bulk/route.ts"),read("../app/api/cron/maintenance/route.ts")]);
  for(const source of [propertyRoute,pgRoute,bulk,cron])assert.match(source,/processPushQueue/);
  assert.match(propertyRoute,/action==="publish"/);assert.match(pgRoute,/action==="publish"/);assert.match(cron,/authorized\(request\)/);
});
