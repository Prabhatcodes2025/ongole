import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {canManagePropertyMedia} from "../src/lib/properties/media-authorization";
import {propertyMediaStoragePaths} from "../src/lib/properties/media-storage";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");
const base={isOwner:false,ownerEditable:false,hasPropertiesManage:false,hasPgManage:false,isPgListing:false,requestedPgContext:false};

test("properties.manage takes precedence when an administrator is also the locked owner",()=>{
  assert.equal(canManagePropertyMedia({...base,isOwner:true,ownerEditable:false,hasPropertiesManage:true}),true);
});

test("owners remain restricted to editable property statuses",()=>{
  assert.equal(canManagePropertyMedia({...base,isOwner:true,ownerEditable:true}),true);
  assert.equal(canManagePropertyMedia({...base,isOwner:true,ownerEditable:false}),false);
});

test("pg managers are scoped to PG listings and PG context",()=>{
  assert.equal(canManagePropertyMedia({...base,hasPgManage:true,isPgListing:true,requestedPgContext:true}),true);
  assert.equal(canManagePropertyMedia({...base,hasPgManage:true,isPgListing:false,requestedPgContext:true}),false);
  assert.equal(canManagePropertyMedia({...base,hasPgManage:true,isPgListing:true,requestedPgContext:false}),false);
});

test("storage cleanup includes every unique variant path and no metadata strings",()=>{
  assert.deepEqual(propertyMediaStoragePaths("owner/property/media.webp",{
    display:{path:"owner/property/media.webp",format:"webp"},
    thumbnail:{path:"owner/property/media-thumb.webp"},
    responsive:[{path:"owner/property/media-small.webp"}],
  }),["owner/property/media.webp","owner/property/media-thumb.webp","owner/property/media-small.webp"]);
});

test("media controls use PATCH and DELETE and surface errors in place",async()=>{
  const component=await read("../src/components/property-media-manager.tsx");
  assert.match(component,/method:action==="remove"\?"DELETE":"PATCH"/);
  assert.match(component,/role="alert"/);
  assert.match(component,/router\.refresh\(\)/);
  assert.match(component,/applySuccessfulAction/);
});

test("route redirects browser forms, scopes records, and safely cleans deletion variants",async()=>{
  const route=await read("../app/api/properties/[id]/media/[mediaId]/route.ts");
  assert.match(route,/NextResponse\.redirect\(new URL\(redirectTo,request\.url\),303\)/);
  assert.match(route,/\.eq\("property_id",id\)\.eq\("media_type","image"\)/);
  assert.match(route,/propertyMediaStoragePaths/);
  assert.match(route,/cleanupPending/);
  assert.match(route,/createSupabaseServiceClient\(\)\|\|supabase/);
  assert.match(route,/manage_property_media/);
});

test("database media actions are atomic and retain owner locks and admin policy",async()=>{
  const sql=await read("../supabase/migrations/202611240001_property_media_management_repair.sql");
  assert.match(sql,/public\.has_permission\('properties\.manage'\)/);
  assert.match(sql,/property_record\.owner_id=auth\.uid\(\)[\s\S]*property_record\.status in \('draft','changes_requested'\)/);
  assert.match(sql,/update public\.property_media[\s\S]*case when id=media_record\.id/);
  assert.match(sql,/set is_cover=false[\s\S]*set is_cover=true/);
  assert.match(sql,/delete from public\.property_media where id=target_media/);
  assert.match(sql,/row_number\(\) over\(order by sort_order,id\)-1/);
  assert.doesNotMatch(sql,/create policy|alter table .*disable row level security/i);
});
