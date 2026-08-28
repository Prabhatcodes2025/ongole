import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {formatPropertyPrice} from "../src/lib/format";
import {activeFilterEntries,parsePropertyFilters} from "../src/lib/properties/filters";
import {applicablePropertyDetails} from "../src/lib/properties/validation";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("default booleans and area unit do not become active filters",()=>{
  const filters=parsePropertyFilters({verified:"false",featured:"false",new:"false",available:"false",areaUnit:"sq_ft"});
  assert.deepEqual(activeFilterEntries(filters),[]);
  assert.deepEqual(activeFilterEntries(parsePropertyFilters({minArea:"500",areaUnit:"sq_ft"})).map(([key])=>key),["minArea","areaUnit"]);
});

test("Sale and Rent/Lease prices use the rupee symbol and selected period",()=>{
  assert.equal(formatPropertyPrice({price:6800000,transactionType:"sale"}),"Price: ₹68,00,000");
  assert.equal(formatPropertyPrice({price:15000,transactionType:"rent",rentPeriod:"month"}),"Rent/Lease: ₹15,000 / Month");
  assert.equal(formatPropertyPrice({price:200000,transactionType:"rent",rentPeriod:"year"}),"Rent/Lease: ₹2,00,000 / Year");
  assert.equal(formatPropertyPrice({price:25000,transactionType:"rent",amountBasis:"per_acre_year"}),"Rent/Lease: ₹25,000 / Acre / Year");
});

test("Rent/Lease period is validated and stored without a migration",()=>{
  const valid=applicablePropertyDetails({rentPeriod:"year",propertyAge:"new",bedrooms:"2",bathrooms:"2",facing:"East"},"rent","apartment-flat");
  assert.equal(valid.valid,true);assert.equal(valid.details.rent_period,"year");
  assert.equal(applicablePropertyDetails({propertyAge:"new",bedrooms:"2",bathrooms:"2",facing:"East"},"rent","apartment-flat").valid,false);
});

test("shared listing count is based on renderable rows and final filter UI omits technical defaults",async()=>{
  const[publicSource,listing,filter,rent]=await Promise.all([read("../src/lib/properties/public.ts"),read("../src/components/public-property-listing-page.tsx"),read("../src/components/property-filter-form.tsx"),read("../app/properties-for-rent/page.tsx")]);
  assert.match(publicSource,/const renderableRows=rows\.filter/);assert.match(publicSource,/const total=renderableRows\.length/);assert.match(publicSource,/purpose==="rent"\?query\.in\("transaction_type",\["rent","lease"\]\)/);
  assert.doesNotMatch(listing,/listing-hero-actions|Post Property/);assert.match(listing,/activeFilterLabel/);assert.doesNotMatch(filter,/Verified only|name="district"/);assert.match(filter,/unit\.disabled=true/);assert.match(rent,/Properties for Rent \/ Lease/);
});

test("shared property detail hides blank fields and uses final transaction terminology",async()=>{
  const[page,card,publicSource]=await Promise.all([read("../app/property/[slug]/page.tsx"),read("../src/components/property-card.tsx"),read("../src/lib/properties/public.ts")]);
  assert.match(page,/formatPropertyPrice/);assert.match(page,/Properties for Rent \/ Lease/);assert.match(page,/Ground Floor/);assert.match(page,/Amenities & Facilities/);assert.match(page,/Property Features/);assert.match(page,/Similar Properties/);assert.doesNotMatch(page,/Not provided|Security Deposit/);
  assert.match(card,/View More Details/);assert.match(publicSource,/details\.video_approved===true/);
});
