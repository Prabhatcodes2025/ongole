import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("draft creation uses the authenticated user and ignores browser ownership",async()=>{
  const route=await read("../app/api/properties/route.ts");
  assert.match(route,/supabase\.auth\.getUser\(\)/);
  assert.match(route,/owner_id: auth\.user\.id/);
  assert.doesNotMatch(route,/payload\.owner_id|data\.owner_id/);
  assert.match(route,/status: "draft"/);
});

test("draft payload normalizes unresolved foreign keys and excludes generated area",async()=>{
  const route=await read("../app/api/properties/route.ts");
  assert.match(route,/category_id:category\?\.id\|\|null/);
  assert.match(route,/property_type_id:propertyType\?\.id\|\|null/);
  assert.doesNotMatch(route,/area_sq_ft\s*:/);
  assert.doesNotMatch(route,/area_gadi\s*:/);
});

test("draft slug is collision-safe and success opens the owner editor",async()=>{
  const route=await read("../app/api/properties/route.ts");
  assert.match(route,/slug: `\$\{baseSlug\}-\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(route,/select\("id,reference_no"\)\.single\(\)/);
  assert.match(route,/dashboard\/properties\/\$\{data\.id\}\?notice=created/);
});

test("corrective migration grants only authenticated sequence access and preserves owner RLS",async()=>{
  const migration=await read("../supabase/migrations/202607180004_property_draft_creation_hotfix.sql");
  assert.match(migration,/grant usage, select on sequence public\.property_reference_seq to authenticated/);
  assert.doesNotMatch(migration,/to anon/);
  assert.match(migration,/owner_id = auth\.uid\(\)/);
  assert.doesNotMatch(migration,/disable row level security/);
});

test("initial draft history is atomic and audit failure cannot hide a created draft",async()=>{
  const[migration,route]=await Promise.all([read("../supabase/migrations/202607180004_property_draft_creation_hotfix.sql"),read("../app/api/properties/route.ts")]);
  assert.match(migration,/after insert on public\.properties/);
  assert.match(migration,/insert into public\.property_status_history/);
  assert.match(route,/property\.draft_audit_failed/);
  assert.match(route,/PROPERTY_DRAFT_CREATE_FAILED/);
  assert.match(route,/payloadKeys:Object\.keys\(insertPayload\)/);
});

test("trigger hotfix replaces the unsafe statement refresh with row-targeted updates",async()=>{
  const migration=await read("../supabase/migrations/202607270001_property_trigger_update_hotfix.sql");
  assert.match(migration,/drop trigger if exists refresh_master_usage_after_property/);
  assert.match(migration,/for each row execute function public\.refresh_master_usage_trigger/);
  assert.doesNotMatch(migration,/perform public\.refresh_master_usage_counts/);
  for(const statement of migration.matchAll(/update public\.(?:property_categories|property_types|locations|master_items)[\s\S]*?;/gi)){
    assert.match(statement[0],/\bwhere\b/i);
  }
  assert.match(migration,/new\.updated_at := now\(\)/);
  assert.doesNotMatch(migration,/update public\.properties set updated_at/i);
  assert.match(migration,/set search_path = public, pg_temp/g);
});

test("draft-history trigger remains insert-only and is not duplicated by the trigger hotfix",async()=>{
  const migration=await read("../supabase/migrations/202607270001_property_trigger_update_hotfix.sql");
  const historyFunction=migration.match(/create or replace function public\.record_initial_property_history\(\)[\s\S]*?end \$\$;/i)?.[0]||"";
  assert.match(historyFunction,/insert into public\.property_status_history/);
  assert.doesNotMatch(historyFunction,/\bupdate\b/i);
  assert.doesNotMatch(migration,/create trigger property_draft_initial_history/i);
});
