import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {ABSOLUTE_TIMEOUT_MS,IDLE_TIMEOUT_MS,sessionTiming} from "../src/lib/auth/session-control";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("session timing enforces 30 minute idle and 24 hour absolute limits",()=>{
  const now=2_000_000_000_000;assert.equal(IDLE_TIMEOUT_MS,30*60*1000);assert.equal(ABSOLUTE_TIMEOUT_MS,24*60*60*1000);
  assert.equal(sessionTiming(String(now-1_000),String(now-1_000),now).expired,false);
  assert.equal(sessionTiming(String(now-IDLE_TIMEOUT_MS-1),String(now-IDLE_TIMEOUT_MS-1),now).expired,true);
  assert.equal(sessionTiming(String(now-ABSOLUTE_TIMEOUT_MS-1),String(now-1_000),now).expired,true);
  assert.equal(sessionTiming(undefined,undefined,now).expired,true);
});

test("remaining posting and account controls are wired",async()=>{
  const[fields,sale,rent,profile,deactivationForm,proxy,migration]=await Promise.all([read("../src/components/property-posting-fields.tsx"),read("../app/properties-for-sale/page.tsx"),read("../app/properties-for-rent/page.tsx"),read("../app/dashboard/profile/page.tsx"),read("../src/components/account-deactivation-form.tsx"),read("../proxy.ts"),read("../supabase/migrations/202609110002_account_soft_deactivation.sql")]);
  assert.match(fields,/nearbyOtherName/);assert.match(fields,/\[2,3\]\.map/);assert.match(fields,/nearbyOtherName\$\{index\}/);
  assert.match(sale,/Post Sale Property/);assert.match(rent,/Post Rent\/Lease Property/);assert.match(profile,/AccountDeactivationForm/);assert.match(deactivationForm,/DELETE MY ACCOUNT/);assert.match(proxy,/SESSION_ACTIVITY_COOKIE/);assert.match(migration,/deactivate_current_account/);assert.match(migration,/reactivate_current_account/);assert.doesNotMatch(migration,/delete from public\.profiles/i);
});
