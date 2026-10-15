import assert from"node:assert/strict";
import{readFile}from"node:fs/promises";
import test from"node:test";
import{canManagePropertyMedia}from"../src/lib/properties/media-authorization";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");
const allowed=(overrides:Partial<Parameters<typeof canManagePropertyMedia>[0]>)=>canManagePropertyMedia({isOwner:false,ownerEditable:false,hasPropertiesManage:false,hasPgManage:false,isPgListing:false,requestedPgContext:false,...overrides});

test("property media authorization keeps PG and ordinary property scopes separate",()=>{
  assert.equal(allowed({hasPgManage:true,isPgListing:true,requestedPgContext:true}),true,"pg.manage-only may manage genuine PG media");
  assert.equal(allowed({hasPgManage:true,isPgListing:false,requestedPgContext:true}),false,"PG context cannot turn ordinary property media into PG media");
  assert.equal(allowed({hasPgManage:true,isPgListing:true,requestedPgContext:false}),false,"pg.manage-only requires the PG workflow");
  assert.equal(allowed({hasPropertiesManage:true}),true,"properties.manage-only may manage ordinary media");
  assert.equal(allowed({hasPropertiesManage:true,hasPgManage:true}),true,"both permissions retain properties.manage access");
  assert.equal(allowed({isOwner:true,ownerEditable:true}),true,"editable owners retain access");
  assert.equal(allowed({isOwner:true,ownerEditable:false}),false,"locked owner media stays locked");
  assert.equal(allowed({}),false,"unauthorized users remain denied");
});

test("migration scopes PG media and posting bypass atomically",async()=>{
  const sql=await read("../supabase/migrations/202610140001_launch_admin_rbac_analytics.sql");
  assert.match(sql,/^--[^\n]*\n--[^\n]*\n\nbegin;/);
  assert.match(sql,/commit;\s*$/);
  assert.match(sql,/pg\.property_id=property_media\.property_id/);
  assert.match(sql,/pg\.property_id::text=\(storage\.foldername\(name\)\)\[2\]/);
  const ordinary=sql.slice(sql.indexOf("create or replace function public.check_property_posting_permission()"),sql.indexOf("create or replace function public.check_pg_posting_permission()"));
  assert.match(ordinary,/privileged:=public\.has_permission\('properties\.manage'\);/);
  assert.doesNotMatch(ordinary,/pg\.manage/);
  const pg=sql.slice(sql.indexOf("create or replace function public.check_pg_posting_permission()"),sql.indexOf("create or replace function public.consume_property_posting_permission"));
  assert.match(pg,/properties\.manage[\s\S]*pg\.manage/);
  assert.match(sql,/pg_workflow and public\.has_permission\('pg\.manage'\)/);
  assert.match(sql,/property\.privileged_posting_bypass/);
});

test("server routes verify permission and genuine PG association",async()=>{
  const[pgRoute,upload,action]=await Promise.all([read("../app/api/pg/route.ts"),read("../app/api/properties/[id]/media/route.ts"),read("../app/api/properties/[id]/media/[mediaId]/route.ts")]);
  assert.match(pgRoute,/rpc\("check_pg_posting_permission"\)/);
  for(const source of[upload,action]){
    assert.match(source,/required_permission:"properties\.manage"/);
    assert.match(source,/required_permission:"pg\.manage"/);
    assert.match(source,/from\("pg_listings"\).*eq\("property_id",id\)/);
    assert.match(source,/canManagePropertyMedia/);
  }
});
