import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {propertyEditDefaults} from "../src/lib/properties/edit-defaults";
import {resolvePropertyEditMode} from "../src/lib/properties/edit-authorization";

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("admin property defaults preserve dynamic, contact, amenity and nearby values",()=>{
  const defaults=propertyEditDefaults({transaction_type:"rent",title:"Central Ongole shop for rent",description:"A well located commercial shop available for rent.",locality_text:"Trunk Road",city_text:"Ongole",district_text:"Prakasam",state_text:"Andhra Pradesh",price_inr:25000,area_value:1200,area_unit:"sq_ft",details:{category:"commercial",property_type_slug:"shop",address_line:"12 Trunk Road",contact:{name:"Agent",mobile:"9876543210",email:"agent@example.com"},amenities:["parking","water_supply"],nearby_places:{hospital:{distance:2,unit:"Km"},other:{name:"Market",distance:300,unit:"Meter"}},legacy_key:{keep:true}}});
  assert.equal(defaults.transactionType,"rent");assert.equal(defaults.propertyType,"shop");assert.equal(defaults.contactMobile,"9876543210");assert.equal(defaults.amenity_parking,true);assert.equal(defaults.amenity_water_supply,true);assert.equal(defaults.nearbyHospital,2);assert.equal(defaults.nearbyOtherName,"Market");
});

test("dedicated editor and server mutation enforce admin workflow safeguards",()=>{
  const page=read("app/admin/properties/[id]/edit/page.tsx"),route=read("app/api/properties/[id]/route.ts"),review=read("app/admin/properties/[id]/page.tsx");
  assert.match(page,/PERMISSIONS\.propertiesManage/);assert.match(page,/originalUpdatedAt/);assert.match(page,/Back to Review/);assert.match(page,/returnTo=admin/);assert.match(page,/adminIdentityEdit/);
  assert.match(review,/Edit Property Details/);assert.match(review,/\/admin\/properties\/\$\{id\}\/edit/);
  assert.match(page,/name="editContext" value="admin"/);assert.match(route,/has_permission/);assert.match(route,/properties\.manage/);assert.match(route,/editMode==="owner"/);assert.match(route,/\.eq\("updated_at",value\.originalUpdatedAt\)/);assert.match(route,/changed_fields/);assert.match(route,/\[redacted\]/);assert.doesNotMatch(route,/owner_id:value/);
});

test("verified admin context overrides owner lifecycle locks without weakening owner edits",()=>{
  assert.equal(resolvePropertyEditMode({isOwner:true,hasManagePermission:true,requestedAdminEdit:true}),"admin","an authorized admin may manage a property tied to the same user id");
  assert.equal(resolvePropertyEditMode({isOwner:true,hasManagePermission:false,requestedAdminEdit:false}),"owner","ordinary owner editing remains owner-scoped");
  assert.equal(resolvePropertyEditMode({isOwner:true,hasManagePermission:false,requestedAdminEdit:true}),"denied","a client admin flag grants no authority");
  assert.equal(resolvePropertyEditMode({isOwner:false,hasManagePermission:true,requestedAdminEdit:true}),"admin","authorized admins may edit customer and agent submissions");
  assert.equal(resolvePropertyEditMode({isOwner:false,hasManagePermission:false,requestedAdminEdit:true}),"denied","unauthorized users cannot use the admin editor");
});

test("editor warns about incompatible identity changes and unsaved navigation",()=>{
  const fields=read("src/components/property-posting-fields.tsx"),workflow=read("src/components/property-posting-workflow.tsx");
  assert.match(fields,/Changing the \$\{label\}/);assert.match(fields,/window\.confirm/);assert.match(workflow,/beforeunload/);assert.match(workflow,/Discard your unsaved property changes/);assert.match(workflow,/disabled=\{busy\}/);
});
