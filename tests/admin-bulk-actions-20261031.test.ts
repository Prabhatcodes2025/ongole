import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {requestData} from "../src/lib/request";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("JSON bulk payload preserves every selected id",async()=>{
  const ids=["00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002"];
  const request=new Request("http://localhost/api/admin/properties/bulk",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"archive",ids})});
  const data=await requestData(request as never);assert.deepEqual(data.ids,ids);
});

test("property, PG and enquiry lists expose controlled multi-selection",async()=>{
  const[control,properties,pg,enquiries]=await Promise.all([read("../src/components/admin/bulk-action-controls.tsx"),read("../app/admin/properties/page.tsx"),read("../app/admin/pg/page.tsx"),read("../app/admin/enquiries/page.tsx")]);
  for(const marker of["Select All","Deselect All","selected","Applying…","bulk-failures","router.refresh()","JSON.stringify({action,ids","failedIds.has(box.value)"])assert.ok(control.includes(marker),marker);
  for(const source of[properties,pg,enquiries]){assert.match(source,/BulkActionControls/);assert.match(source,/data-bulk-id="true"/)}
});

test("bulk APIs return per-record success, failure and skipped results without permanent deletion",async()=>{
  const[property,pg,enquiry]=await Promise.all([read("../app/api/admin/properties/bulk/route.ts"),read("../app/api/admin/pg/bulk/route.ts"),read("../app/api/admin/enquiries/bulk/route.ts")]);
  for(const source of[property,pg,enquiry]){assert.match(source,/results/);assert.match(source,/succeeded/);assert.match(source,/failed/)}
  assert.match(property,/soft_delete/);assert.match(property,/skipped/);assert.match(property,/persistence_mismatch/);assert.doesNotMatch(property+pg+enquiry,/permanent_delete/);
  assert.match(property,/const actions=\["publish","archive","soft_delete","activate"\]/);for(const removed of["deactivate","feature","unfeature","verify","unverify","pin","unpin"])assert.doesNotMatch(property,new RegExp(`"${removed}"`));
  assert.match(property,/target_properties:\[id\]/);assert.match(pg,/admin_bulk_pg_action/);assert.match(enquiry,/target_ids:\[id\]/);
});

test("single property and PG deletion report success only after database absence verification",async()=>{const[control,property,pg]=await Promise.all([read("../src/components/admin/property-deletion-controls.tsx"),read("../app/api/admin/properties/[id]/deletion/route.ts"),read("../app/api/admin/pg/[id]/deletion/route.ts")]);assert.match(control,/physicallyDeleted/);for(const source of[property,pg]){assert.match(source,/verification\.data/);assert.match(source,/physicallyDeleted:true/);assert.match(source,/verification_failed/)}});

test("PG bulk migration uses pg.manage and remains authenticated-only",async()=>{
  const sql=await read("../supabase/migrations/202610310001_admin_bulk_actions.sql");assert.match(sql,/has_permission\('pg\.manage'\)/);assert.match(sql,/revoke all on function public\.admin_bulk_pg_action\(uuid\[\],text\)/);assert.match(sql,/grant execute on function public\.admin_bulk_pg_action\(uuid\[\],text\) to authenticated/);assert.doesNotMatch(sql,/grant execute[^;]+service_role/);
});

test("property Admin repair preserves content checks while fixing lifecycle and retention semantics",async()=>{const sql=await read("../supabase/migrations/202610310002_property_admin_action_repair.sql");assert.match(sql,/before insert or update of title,description on public\.properties/);assert.doesNotMatch(sql,/update of title,description,status/);for(const marker of["property_title_prohibited_content","property_description_prohibited_content","soft_delete","restore","property\.bulk_","retention_required:enquiries","retention_required:promotions","retention_required:payments","on delete set null","property_reference"])assert.ok(sql.includes(marker),marker);assert.doesNotMatch(sql,/retention_required:posting/)});

test("property bulk UI exposes only the four lifecycle actions",async()=>{const page=await read("../app/admin/properties/page.tsx");for(const action of[["publish","Publish Approved"],["archive","Archive"],["soft_delete","Soft Delete (recoverable)"],["activate","Restore"]])assert.ok(page.includes(`["${action[0]}","${action[1]}"]`));for(const removed of["Feature","Remove feature","Priority Listing","Pin","Unpin"])assert.doesNotMatch(page,new RegExp(`\\[\\"[^\\"]+\\",\\"${removed}`))});
