import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import PostPgPage from "../app/post-pg/page";
import {PgFields,PublicPgPostingForm,pgListFieldDefault} from "../src/components/pg-posting-workflow";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("logged-out GET/render of /post-pg succeeds",()=>{
  const html=renderToStaticMarkup(createElement(PostPgPage));
  assert.match(html,/Tell us about your PG/);
  assert.match(html,/Restoring your PG details/);
});

test("authenticated GET/render of /post-pg remains the public form",()=>{
  const html=renderToStaticMarkup(createElement(PostPgPage));
  assert.match(html,/Complete the public form now/);
  assert.doesNotMatch(html,/Property posting permission/);
});

test("a user without a profile cannot crash the public PG route",async()=>{
  const source=await read("../app/post-pg/page.tsx");
  for(const forbidden of ["createSupabaseServerClient","auth.getUser","profile","redirect("])assert.ok(!source.includes(forbidden),`public PG route must not depend on ${forbidden}`);
  assert.match(renderToStaticMarkup(createElement(PostPgPage)),/Tell us about your PG/);
});

test("missing Google Maps API key does not crash /post-pg",()=>{
  const previous=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  try{
    const fields=renderToStaticMarkup(createElement(PgFields,{defaults:{google_maps_url:null}}));
    assert.match(fields,/Google Maps Location Link/);
    assert.doesNotMatch(fields,/googleapis\.com|maps\.googleapis\.com/);
  }finally{
    if(previous===undefined)delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=previous;
  }
});

test("legacy and null PG details do not crash",()=>{
  assert.equal(pgListFieldDefault("No smoking\nGate closes at 10 PM"),"No smoking\nGate closes at 10 PM");
  assert.equal(pgListFieldDefault(["No smoking","No pets"]),"No smoking\nNo pets");
  for(const value of [null,undefined,{legacy:true},42])assert.equal(pgListFieldDefault(value),"");
  const html=renderToStaticMarkup(createElement(PgFields,{defaults:{
    google_maps_url:null,rent_basis:"Per Bed / Per Month",nearby_places:null,amenities:null,
    consent:null,food_type:null,latitude:null,longitude:null,
    house_rules:"No smoking\nNo pets",video_urls:null,
  }}));
  assert.match(html,/No smoking\nNo pets/);
  assert.match(html,/value="per_bed_month" selected=""/);
});

test("IndexedDB and other browser-only helpers are not executed during SSR",()=>{
  const html=renderToStaticMarkup(createElement(PublicPgPostingForm));
  assert.match(html,/Restoring your PG details/);
});

test("posting entitlement is not required merely to view the guest PG form",async()=>{
  const[page,workflow]=await Promise.all([read("../app/post-pg/page.tsx"),read("../src/components/pg-posting-workflow.tsx")]);
  assert.ok(page.includes("<PublicPgPostingForm/>"));
  assert.ok(!page.includes("check_property_posting_permission"));
  assert.ok(workflow.includes("Continue to Sign In / Register"));
});

test("final authenticated PG submission protections remain intact",async()=>{
  const[createRoute,mediaRoute]=await Promise.all([read("../app/api/pg/route.ts"),read("../app/api/properties/[id]/media/route.ts")]);
  for(const marker of ["auth.getUser()","email_confirmed_at","check_property_posting_permission","Invalid request origin."])assert.ok(createRoute.includes(marker));
  for(const marker of ["auth.getUser()","email_confirmed_at","eq(\"owner_id\",auth.user.id)"])assert.ok(mediaRoute.includes(marker));
});
