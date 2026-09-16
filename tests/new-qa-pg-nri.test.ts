import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {EnquiryForm} from "../src/components/enquiry-form";
import {pgDraftSchema} from "../src/lib/pg/validation";
import {enquirySchema} from "../src/lib/enquiries/validation";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");
const pgBase={pg_name:"Sai Residency",category:"womens",description:"A comfortable paying guest home",address_line:"Main Road",locality:"Ongole",city:"Ongole Urban",district:"Prakasam",state:"Andhra Pradesh",rent_per_bed:6500,amenities:[],house_rules:[],video_urls:[]};
const nriBase={formContext:"nri",name:"NRI Client",email:"nri@example.com",propertyRequirement:"Property tracing",message:"Please help trace our family property.",consent:"true"};

test("PG validation restricts food type, requires consent, and preserves coordinate pairs",()=>{
  for(const food_type of ["Vegetarian","Non-Vegetarian","Mixed",""])assert.equal(pgDraftSchema.safeParse({...pgBase,food_type,consent:"true",latitude:"15.5",longitude:"80.05"}).success,true);
  assert.equal(pgDraftSchema.safeParse({...pgBase,food_type:"Sometimes veg",consent:"true"}).success,false);
  assert.equal(pgDraftSchema.safeParse({...pgBase,food_type:"Mixed"}).success,false);
  assert.equal(pgDraftSchema.safeParse({...pgBase,food_type:"Mixed",consent:"true",latitude:"15.5"}).success,false);
});

test("NRI validation keeps Indian mobile optional and validates both phone paths and consent",()=>{
  assert.equal(enquirySchema.safeParse(nriBase).success,true);
  assert.equal(enquirySchema.safeParse({...nriBase,mobile:"1234567890"}).success,false);
  assert.equal(enquirySchema.safeParse({...nriBase,mobile:"9988767689"}).success,true);
  assert.equal(enquirySchema.safeParse({...nriBase,isForeign:"true",countryCode:"+44",foreignMobile:"7700900123"}).success,true);
  assert.equal(enquirySchema.safeParse({...nriBase,isForeign:"true",countryCode:"+44",foreignMobile:"12"}).success,false);
  assert.equal(enquirySchema.safeParse({...nriBase,consent:""}).success,false);
});

test("NRI form has the exact always-visible Indian phone and hidden-by-default foreign controls",()=>{
  const html=renderToStaticMarkup(createElement(EnquiryForm,{variant:"nri"}));
  assert.match(html,/Mobile Number/);assert.match(html,/name="mobile"/);assert.doesNotMatch(html,/name="mobile"[^>]*required/);
  assert.match(html,/NRI\? Use foreign mobile number\./);assert.doesNotMatch(html,/name="foreignMobile"/);
  assert.match(html,/Property Requirement[\s\S]*textarea/);assert.match(html,/I confirm I am authorized to submit this enquiry/);assert.match(html,/Send Your Requirement/);
});

test("PG and public search share the Mandal source and PG uses one coordinate picker",async()=>{
  const[pg,search,filter,picker,api,submitApi]=await Promise.all([read("../src/components/pg-posting-workflow.tsx"),read("../src/components/property-search.tsx"),read("../src/components/property-filter-form.tsx"),read("../src/components/property-location-picker.tsx"),read("../app/api/pg/route.ts"),read("../app/api/pg/[id]/submit/route.ts")]);
  for(const source of [pg,search,filter])assert.match(source,/MandalTownAutocomplete/);
  assert.match(search,/label="Town\/Mandal"/);assert.match(filter,/label="Town\/Mandal"/);
  assert.match(pg,/PropertyLocationPicker/);assert.doesNotMatch(pg,/>Latitude<input|>Longitude<input/);
  assert.match(picker,/name="latitude"/);assert.match(picker,/name="longitude"/);assert.match(api,/listing_communication_consent/);assert.match(submitApi,/consent\.accepted!==true/);
});

test("NRI page contracts include compact grid, anchors, closed accordion, and secured existing backend",async()=>{
  const[page,css,faq,api,migration]=await Promise.all([read("../app/nri-services-ongole/page.tsx"),read("../app/globals.css"),read("../src/components/nri-faq.tsx"),read("../app/api/enquiries/route.ts"),read("../supabase/migrations/202609170001_nri_optional_mobile.sql")]);
  for(const id of ["nri-services","property-tracing","nri-process","nri-faq","nri-enquiry"])assert.match(page,new RegExp(`id="${id}"`));
  assert.match(css,/\.nri-service-cards\{grid-template-columns:repeat\(2/);assert.match(css,/\.nri-page \.section\{padding-block:54px\}/);
  assert.match(faq,/useState<number\|null>\(null\)/);assert.match(faq,/aria-expanded/);assert.match(faq,/hidden=\{!expanded\}/);
  for(const marker of ["indian_mobile","foreign_mobile","communication_consent","checkRateLimit","verifyCaptcha"])assert.match(api,new RegExp(marker));
  assert.match(migration,/alter column mobile drop not null/);assert.match(migration,/mobile is null/);
});
