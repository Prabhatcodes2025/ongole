import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {PG_AMENITIES} from "../src/types/pg";
import {nearbyPlacesDefaults,nearbyPlacesFromInput} from "../src/lib/properties/validation";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("public Sale, Rent and PG details retain published/expired privacy gates",async()=>{
  const[propertyPublic,pgPublic,card,pgList]=await Promise.all([read("../src/lib/properties/public.ts"),read("../src/lib/pg/public.ts"),read("../src/components/property-card.tsx"),read("../app/paying-guest/page.tsx")]);
  for(const source of [propertyPublic,pgPublic]){assert.match(source,/\["published","expired"\]/);assert.match(source,/deleted_at/)}
  assert.match(card,/href={`\/property\/\$\{property\.slug\}`}/);assert.match(pgList,/href={`\/paying-guest\/\$\{pg\.slug\}`}/);
  assert.match(propertyPublic,/get_property_contact/);assert.match(pgPublic,/property\.status==="published"/);assert.match(propertyPublic,/createSignedUrls/);assert.match(pgPublic,/createSignedUrls/);
});

test("Admin entry remains session and permission protected",async()=>{
  const[root,properties,pg]=await Promise.all([read("../app/admin/page.tsx"),read("../app/admin/properties/page.tsx"),read("../app/admin/pg/page.tsx")]);
  assert.match(root,/auth\.getUser\(\)/);assert.match(root,/get_current_auth_context/);assert.match(root,/admin_role_required/);
  assert.match(properties,/required_permission:"properties\.read"/);assert.match(pg,/required_permission:"pg\.read"/);
});

test("owner previews stay private, allow authorized Admin inspection, and expose editor controls",async()=>{
  const[property,pg]=await Promise.all([read("../app/dashboard/properties/[id]/preview/page.tsx"),read("../app/dashboard/pg/[id]/preview/page.tsx")]);
  for(const source of [property,pg]){assert.match(source,/auth\.getUser\(\)/);assert.match(source,/resolvePropertyDashboardAccess/);assert.match(source,/robots:\{index:false,follow:false\}/);assert.match(source,/owner-preview-action/);assert.match(source,/Return to Editor/);assert.match(source,/nearby/i)}
  assert.match(property,/Amenities &amp; facilities/);assert.match(property,/video preview/);assert.match(pg,/House rules/);assert.match(pg,/video preview/);
});

test("posting entitlement dead ends include Admin, Dashboard and Home actions",async()=>{
  const[actions,property,pg,entry]=await Promise.all([read("../src/components/posting-entitlement-actions.tsx"),read("../app/dashboard/properties/new/page.tsx"),read("../app/dashboard/pg/new/page.tsx"),read("../app/post-property/page.tsx")]);
  for(const label of ["Contact admin","Go to Dashboard","Back to Home"])assert.match(actions,new RegExp(label));
  for(const source of [property,pg,entry])assert.match(source,/PostingEntitlementActions/);
});

test("Rent entry defaults Rent/Lease while restored transaction remains authoritative",async()=>{
  const[listing,entry,workflow,fields]=await Promise.all([read("../src/components/public-property-listing-page.tsx"),read("../app/post-property/page.tsx"),read("../src/components/property-posting-workflow.tsx"),read("../src/components/property-posting-fields.tsx")]);
  assert.match(listing,/purpose==="rent"\?"rent":"sale"/);assert.match(entry,/query\.transaction==="rent"\?"rent":"sale"/);
  assert.match(workflow,/Object\.keys\(parsed\)\.length\?parsed:\{transactionType:initialTransaction\}/);assert.match(fields,/<option value="rent">Rent<\/option>/);
});

test("searchable Rent property type reopens the current category's full catalog",async()=>{
  const fields=await read("../src/components/property-posting-fields.tsx");
  assert.match(fields,/function SearchablePropertyType/);assert.match(fields,/setQuery\(""\);setOpen\(true\)/);assert.match(fields,/options\.filter/);assert.match(fields,/role="listbox"/);assert.match(fields,/role="combobox"/);
  assert.match(fields,/setCategory\(event\.target\.value\);setPropertyType/);
});

test("PG amenities use the compact primary set without removing the existing Gym option",async()=>{
  const css=await read("../app/globals.css");
  for(const item of ["WiFi","AC","Laundry","Parking","CCTV","Power Backup","Food","Housekeeping","Hot Water","TV","Lift","Security","Gym"])assert.ok(PG_AMENITIES.includes(item as typeof PG_AMENITIES[number]));
  assert.match(css,/\.pg-amenities \.check-grid\{display:grid;grid-template-columns:repeat\(7/);assert.match(css,/max-width:1000px[\s\S]*repeat\(5/);assert.match(css,/max-width:720px[\s\S]*\.pg-amenities \.check-grid\{grid-template-columns:repeat\(2/);assert.match(css,/max-width:340px[\s\S]*grid-template-columns:1fr/);assert.match(css,/\.pg-amenities \.check-grid input\{width:auto!important;min-height:0;padding:0/);assert.match(css,/white-space:normal;word-break:normal;overflow-wrap:normal/);
});

test("PG nearby places share the Sale/Rent structure and survive save/restore/display",async()=>{
  const input={nearbyRailwayStation:"1.2",nearbyRailwayStationUnit:"km",nearbyAtm:"300",nearbyAtmUnit:"meter",nearbyOtherName:"Park",nearbyOtherDistance:"450",nearbyOtherDistanceUnit:"meter"};const parsed=nearbyPlacesFromInput(input);assert.deepEqual(parsed.errors,{});const restored=nearbyPlacesDefaults(parsed.nearby);assert.equal(restored.nearbyRailwayStation,1.2);assert.equal(restored.nearbyAtm,300);assert.equal(restored.nearbyOtherName,"Park");
  const[fields,create,update,publicSource,page]=await Promise.all([read("../src/components/pg-posting-workflow.tsx"),read("../app/api/pg/route.ts"),read("../app/api/pg/[id]/route.ts"),read("../src/lib/pg/public.ts"),read("../app/paying-guest/[slug]/page.tsx")]);
  assert.match(fields,/NearbyPlaceFields/);for(const source of [create,update])assert.match(source,/nearby_places/);assert.match(publicSource,/nearbyItems/);assert.match(page,/Nearby Places \/ Landmarks/);
});

test("guest PG flow autosaves versioned data and uploads media only after authentication",async()=>{
  const[workflow,create,media]=await Promise.all([read("../src/components/pg-posting-workflow.tsx"),read("../app/api/pg/route.ts"),read("../app/api/properties/[id]/media/route.ts")]);
  for(const marker of ["STORAGE_VERSION","savedAt","MAX_AGE_MS","indexedDB","storeGuestMedia","readGuestMedia","clearDraft"])assert.match(workflow,new RegExp(marker));
  assert.match(workflow,/Continue to Sign In \/ Register/);assert.match(workflow,/\/api\/auth\/context/);assert.match(workflow,/\/api\/properties\/\$\{result\.propertyId\}\/media/);
  assert.match(create,/auth\.getUser\(\)/);assert.match(media,/email_confirmed_at/);assert.match(media,/eq\("owner_id",auth\.user\.id\)/);assert.doesNotMatch(media,/anon/i);
});

test("NRI alignment, neutral consent and quick-nav pill contracts remain responsive",async()=>{
  const[form,page,css]=await Promise.all([read("../src/components/enquiry-form.tsx"),read("../app/nri-services-ongole/page.tsx"),read("../app/globals.css")]);
  assert.match(form,/nri-form-row-one/);assert.equal((form.match(/nri-textarea-row/g)||[]).length,2);assert.match(form,/input required type="checkbox" name="consent"/);
  for(const anchor of ["#nri-services","#property-tracing","#nri-process","#nri-faq","#nri-enquiry"])assert.match(page,new RegExp(anchor));
  assert.match(css,/\.nri-form-row-one input[^}]*height:44px/);assert.match(css,/\.nri-consent\{border:1px solid var\(--line\)/);assert.match(css,/input:user-invalid/);assert.match(css,/\.nri-quick-nav a\{padding:9px 15px;border:1px/);
});
