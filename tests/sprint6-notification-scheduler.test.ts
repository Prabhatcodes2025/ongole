import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("Vercel maintenance cron is daily and calls an authenticated route",async()=>{
  const config=JSON.parse(await read("../vercel.json"));
  assert.deepEqual(config.crons,[{path:"/api/cron/maintenance",schedule:"15 0 * * *"}]);
  const route=await read("../app/api/cron/maintenance/route.ts");
  assert.match(route,/env\.cronSecret/);
  assert.match(route,/timingSafeEqual/);
  assert.match(route,/createSupabaseServiceClient/);
  assert.match(route,/enqueue_expiry_notifications/);
  assert.match(route,/expire_promotions/);
  assert.match(route,/aggregate_analytics/);
  assert.match(route,/force-dynamic/);
});

test("notification worker claims queue rows and applies bounded retries",async()=>{
  const worker=await read("../src/lib/jobs/notifications.ts");
  assert.match(worker,/MAX_ATTEMPTS=5/);
  assert.match(worker,/\.eq\("status","queued"\)/);
  assert.match(worker,/\.eq\("status","pending"\)/);
  assert.match(worker,/status:"processing"/);
  assert.match(worker,/next_attempt_at:retryAt\(attempt\)/);
  assert.match(worker,/stale_claim_recovered/);
  assert.match(worker,/processing_started_at/);
  assert.match(worker,/sendNotificationEmail/);
});

test("forward migration keeps email-only notifications deliverable but hidden in app",async()=>{
  const migration=await read("../supabase/migrations/202607300002_sprint6_notification_scheduler.sql");
  assert.match(migration,/add column if not exists is_in_app_visible boolean not null default true/i);
  assert.match(migration,/add column if not exists processing_started_at timestamptz/i);
  assert.match(migration,/is_in_app_visible\)/i);
  assert.match(migration,/in_app_enabled :=/i);
  assert.match(migration,/email_enabled :=/i);
  assert.match(migration,/values\(result, 'email', 'queued'\)/i);
  assert.match(migration,/set search_path = public, pg_temp/i);
});
