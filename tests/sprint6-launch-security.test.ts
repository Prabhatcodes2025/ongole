import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {isValidIndianMobile,normalizeMobile} from "../src/lib/auth/mobile";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("Indian mobile validation normalizes input and rejects repeated digits",()=>{
  assert.equal(normalizeMobile(" 9876543210 "),"9876543210");
  assert.equal(isValidIndianMobile("9876543210"),true);
  assert.equal(isValidIndianMobile("7777777777"),false);
  assert.equal(isValidIndianMobile("5876543210"),false);
  assert.equal(isValidIndianMobile("98765"),false);
});

test("launch migration uses Sprint 5 subscriptions for contact entitlement",async()=>{
  const migration=await read("../supabase/migrations/202607300001_sprint6_launch_security.sql");
  const contact=migration.slice(migration.indexOf("create or replace function public.get_property_contact"),migration.indexOf("revoke all on function public.get_property_contact"));
  assert.match(contact,/from public\.subscriptions subscription/i);
  assert.match(contact,/subscription\.user_id = property_record\.owner_id/i);
  assert.match(contact,/subscription\.status = 'active'/i);
  assert.match(contact,/subscription\.starts_at <= now\(\)/i);
  assert.match(contact,/subscription\.ends_at > now\(\)/i);
  assert.doesNotMatch(contact,/public\.memberships/i);
  assert.match(contact,/set search_path = public, pg_temp/i);
  assert.match(migration,/grant execute on function public\.get_property_contact\(uuid\) to anon, authenticated/i);
});

test("mobile uniqueness is enforced in both PostgreSQL and application routes",async()=>{
  const[migration,register,profile]=await Promise.all([read("../supabase/migrations/202607300001_sprint6_launch_security.sql"),read("../app/api/auth/[action]/route.ts"),read("../app/api/profile/route.ts")]);
  assert.match(migration,/profiles_mobile_quality_check/i);
  assert.match(migration,/create unique index profiles_mobile_unique_idx/i);
  assert.match(migration,/create or replace function public\.is_mobile_available/i);
  assert.match(migration,/profile\.id is distinct from auth\.uid\(\)/i);
  assert.match(register,/isValidIndianMobile/);
  assert.match(register,/is_mobile_available/);
  assert.match(profile,/isValidIndianMobile/);
  assert.match(profile,/error\.code==="23505"/);
});
