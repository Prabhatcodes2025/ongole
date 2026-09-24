import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {safeGoogleMapsUrl} from "../src/lib/google-maps";
import {normalizePgRentBasis,PG_RENT_BASES} from "../src/types/pg";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("PG Google Maps URLs are allowlisted and unsafe links are rejected",()=>{
  for(const value of ["https://google.com/maps/place/Ongole","https://maps.google.com/?q=Ongole","https://maps.app.goo.gl/abc123"])assert.ok(safeGoogleMapsUrl(value));
  for(const value of ["javascript:alert(1)","http://google.com/maps","https://evil.example/maps","https://google.com.evil.example/maps"])assert.equal(safeGoogleMapsUrl(value),null);
});

test("all PG rent bases and legacy values remain compatible",()=>{
  assert.deepEqual(PG_RENT_BASES,["per_bed_month","per_bed_day","per_room_month","per_room_day"]);
  assert.equal(normalizePgRentBasis("Per Bed / Per Month"),"per_bed_month");
  for(const value of PG_RENT_BASES)assert.equal(normalizePgRentBasis(value),value);
});

test("Sale and Rent guest media stays local until authenticated upload",async()=>{
  const[source,api]=await Promise.all([read("../src/components/property-posting-workflow.tsx"),read("../app/api/properties/[id]/media/route.ts")]);
  for(const marker of ["indexedDB","pending-property","storeGuestMedia","readGuestMedia","clearGuestMedia","/api/auth/context","/api/properties/${result.id}/media"])assert.ok(source.includes(marker));
  for(const marker of ["auth.getUser()","email_confirmed_at","eq(\"owner_id\",auth.user.id)"])assert.ok(api.includes(marker));
});

test("agent application is retained locally until the account step",async()=>{
  const[prefill,registration,google]=await Promise.all([read("../src/components/agent-application-prefill.tsx"),read("../src/components/registration-form.tsx"),read("../app/api/auth/[action]/route.ts")]);
  assert.ok(prefill.includes("localStorage.setItem(AGENT_DRAFT_KEY"));assert.ok(prefill.includes("Continue to Sign In / Register"));
  assert.ok(registration.includes("localStorage.getItem(AGENT_DRAFT_KEY"));assert.ok(google.includes("auth.google_agent_application_failed"));
});

test("PG maps rent basis watermark and deterrence are correctly scoped",async()=>{
  const[form,create,publicPg,page,media,gallery,css]=await Promise.all([read("../src/components/pg-posting-workflow.tsx"),read("../app/api/pg/route.ts"),read("../src/lib/pg/public.ts"),read("../app/paying-guest/[slug]/page.tsx"),read("../app/api/properties/[id]/media/route.ts"),read("../src/components/property-gallery.tsx"),read("../app/globals.css")]);
  assert.ok(form.includes("Google Maps Location Link"));assert.ok(!form.includes("PropertyLocationPicker"));assert.ok(create.includes("safeGoogleMapsUrl"));assert.ok(publicPg.includes("mapsUrl:safeGoogleMapsUrl"));assert.ok(page.includes("View Location on Google Maps"));
  assert.ok(media.includes("isPg?baseImage:baseImage.composite"));assert.ok(gallery.includes("deterDownload"));assert.ok(gallery.includes("onContextMenu"));assert.ok(gallery.includes("draggable={deterDownload?false"));
  assert.ok(css.includes("repeat(2,minmax(0,1fr))"));assert.ok(css.includes("white-space:normal;word-break:normal;overflow-wrap:normal"));
});

test("global public header uses server auth and preserves the GIS flow",async()=>{
  const[header,navigation,google]=await Promise.all([read("../src/components/site-header.tsx"),read("../src/components/public-navigation.tsx"),read("../src/components/google-oauth-button.tsx")]);
  for(const marker of ["auth.getUser()","Dashboard","Edit Profile","/api/auth/logout"])assert.ok(header.includes(marker));assert.ok(navigation.includes("account?"));
  assert.equal((google.match(/gsi\/client/g)||[]).length,1);assert.ok(google.includes("signInWithIdToken"));assert.ok(!google.includes("signInWithOAuth"));
});

test("PG draft creation is idempotent and maps errors safely",async()=>{
  const[workflow,route]=await Promise.all([read("../src/components/pg-posting-workflow.tsx"),read("../app/api/pg/route.ts")]);
  for(const marker of ["client_draft_key","reused:true","pg.draft_create_failed"])assert.ok(route.includes(marker));assert.ok(workflow.includes("client_draft_key"));assert.ok(!route.includes("detail:error.message"));
  assert.ok(workflow.includes("response.status===403"));assert.ok(!workflow.includes("response.status===401||response.status===403"));
});
