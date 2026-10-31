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
  for(const marker of["Select All","Deselect All","selected","Applying…","bulk-failures","router.refresh()","JSON.stringify({action,ids"])assert.ok(control.includes(marker),marker);
  for(const source of[properties,pg,enquiries]){assert.match(source,/BulkActionControls/);assert.match(source,/data-bulk-id="true"/)}
});

test("bulk APIs return per-record results and never offer permanent deletion",async()=>{
  const[property,pg,enquiry]=await Promise.all([read("../app/api/admin/properties/bulk/route.ts"),read("../app/api/admin/pg/bulk/route.ts"),read("../app/api/admin/enquiries/bulk/route.ts")]);
  for(const source of[property,pg,enquiry]){assert.match(source,/results/);assert.match(source,/succeeded/);assert.match(source,/failed/);assert.doesNotMatch(source,/permanent_delete/)}
  assert.match(property,/target_properties:\[id\]/);assert.match(pg,/admin_bulk_pg_action/);assert.match(enquiry,/target_ids:\[id\]/);
});

test("PG bulk migration uses pg.manage and remains authenticated-only",async()=>{
  const sql=await read("../supabase/migrations/202610310001_admin_bulk_actions.sql");assert.match(sql,/has_permission\('pg\.manage'\)/);assert.match(sql,/revoke all on function public\.admin_bulk_pg_action\(uuid\[\],text\)/);assert.match(sql,/grant execute on function public\.admin_bulk_pg_action\(uuid\[\],text\) to authenticated/);assert.doesNotMatch(sql,/grant execute[^;]+service_role/);
});
