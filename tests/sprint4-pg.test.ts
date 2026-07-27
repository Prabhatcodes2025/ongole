import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {pgDraftSchema,pgRoomSchema} from "../src/lib/pg/validation";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("PG draft and room validation enforce supported inventory",()=>{
  assert.equal(pgDraftSchema.safeParse({pg_name:"Sai Residency",category:"womens",locality:"Ongole",city:"Ongole",district:"Prakasam",state:"Andhra Pradesh",rent_per_bed:6500,amenities:["WiFi"],house_rules:[],video_urls:[],description:"",address_line:""}).success,true);
  assert.equal(pgDraftSchema.safeParse({pg_name:"PG",category:"unknown"}).success,false);
  assert.equal(pgRoomSchema.safeParse({name:"Double room",sharing_type:"double",capacity:2,available_beds:3,monthly_rent:7000}).success,false);
  assert.equal(pgRoomSchema.safeParse({name:"Double room",sharing_type:"double",capacity:2,available_beds:1,monthly_rent:7000}).success,true);
});

test("Sprint 4 migration is forward-only, RLS protected, and reuses property lifecycle",async()=>{
  const migration=await read("../supabase/migrations/202607270002_sprint4_paying_guest_module.sql");
  for(const marker of ["create table if not exists public.pg_room_types","enable row level security","owner_id=auth.uid()","pg.manage","create_pg_draft","submit_pg_for_review","property_status_history","set search_path = public, pg_temp"])assert.match(migration,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(migration,/grant\s+(insert|update|delete)[^;]*\s+to\s+anon/i);
  assert.doesNotMatch(migration,/service_role/i);
});

test("owner, public and admin PG workflows are connected",async()=>{
  const[owner,publicList,details,admin,statusApi,sitemap]=await Promise.all([
    read("../app/dashboard/pg/[id]/page.tsx"),read("../app/paying-guest/page.tsx"),read("../app/paying-guest/[slug]/page.tsx"),
    read("../app/admin/pg/[id]/page.tsx"),read("../app/api/admin/pg/[id]/status/route.ts"),read("../app/sitemap.ts")
  ]);
  for(const marker of ["Submit for review","Duplicate PG","Room types","property-media"])assert.match(owner,new RegExp(marker));
  for(const marker of ["Budget from","Room sharing","Beds available now","Amenities"])assert.match(publicList,new RegExp(marker));
  for(const marker of ["LodgingBusiness","EnquiryForm","WhatsApp","Similar PGs"])assert.match(details,new RegExp(marker));
  for(const marker of ["Approve PG","Request changes","Reject","Publish PG","Soft delete"])assert.match(admin,new RegExp(marker));
  assert.match(statusApi,/required_permission:"pg.manage"/);
  assert.match(sitemap,/getPublicPgSlugs/);
});

test("service-role PG data access remains server-only",async()=>{
  const publicService=await read("../src/lib/pg/public.ts");
  assert.match(publicService,/import "server-only"/);
  assert.doesNotMatch(publicService,/NEXT_PUBLIC_SUPABASE_SERVICE/);
});
