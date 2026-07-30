import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("production verifier enforces standard Next.js and launch configuration",async()=>{
  const script=await read("../scripts/verify-production.mjs");
  assert.match(script,/build:"next build"/);
  assert.match(script,/start:"next start"/);
  assert.match(script,/vinext/);
  assert.match(script,/CRON_SECRET/);
  assert.match(script,/SUPABASE_SERVICE_ROLE_KEY/);
  const packageJson=JSON.parse(await read("../package.json"));
  assert.equal(packageJson.scripts["verify:production"],"node scripts/verify-production.mjs");
});

test("health and runbook expose scheduler readiness without leaking its secret",async()=>{
  const[health,runbook]=await Promise.all([read("../app/api/health/route.ts"),read("../docs/PRODUCTION-RUNBOOK.md")]);
  assert.match(health,/scheduler:env\.cronSecret&&env\.supabaseServiceRoleKey\?"configured":"disabled"/);
  assert.doesNotMatch(health,/CRON_SECRET/);
  assert.match(runbook,/202607300002_sprint6_notification_scheduler\.sql/);
  assert.match(runbook,/cron\.maintenance_completed/);
  assert.match(runbook,/having count\(\*\) > 1/i);
});
