import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {isValidIndianMobile} from "../src/lib/auth/mobile";
import {applicablePropertyDetails,propertyContentIsProductionSafe,propertyDescriptionIsPublicSafe,propertyTitleIsProductionSafe} from "../src/lib/properties/validation";
import {enquirySchema} from "../src/lib/enquiries/validation";
import {COUNTRY_CALLING_CODES} from "../src/data/country-calling-codes";
import {validateRegistrationFields} from "../src/lib/auth/registration";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("registration supports Terms evidence, Google OAuth and safe validation logging",async()=>{
  const[route,callback,form,migration,correction]=await Promise.all([read("../app/api/auth/[action]/route.ts"),read("../app/auth/callback/route.ts"),read("../src/components/registration-form.tsx"),read("../supabase/migrations/202608130001_targeted_auth_terms_fix.sql"),read("../supabase/migrations/202608220001_non_home_corrections.sql")]);
  assert.match(route,/signInWithOAuth\(\{provider:"google"/);assert.match(route,/registration_validation_failed/);assert.match(form,/Terms &amp; Conditions/);assert.match(migration,/claim_new_google_owner/);assert.match(migration,/insert into public\.agents/);assert.match(callback,/claim_new_google_account/);assert.match(correction,/requested_account_type not in \('buyer','owner','agent','pg_owner'\)/);assert.doesNotMatch(route,/service.role/i);
  const errors=validateRegistrationFields({name:"",mobile:"123",email:"bad",accountType:"owner",password:"short",termsAccepted:""});
  for(const field of ["name","mobile","email","password","termsAccepted"] as const)assert.ok(errors[field]);
});

test("mobile validation rejects repeated patterns and accepts valid Indian and foreign numbers",()=>{
  assert.equal(isValidIndianMobile("9876543210"),true);assert.equal(isValidIndianMobile("9999999999"),false);assert.equal(isValidIndianMobile("2424242424"),false);
  assert.equal(enquirySchema.safeParse({name:"NRI Client",mobile:"5551234567",isForeign:"true",countryCode:"+1",email:"nri@example.com",message:"Please help with my property requirement."}).success,true);
  assert.equal(enquirySchema.safeParse({name:"Finland Client",mobile:"401234567",isForeign:"true",countryCode:"+358",email:"nri@example.com",message:"Please help with my property requirement."}).success,true);
  assert.equal(enquirySchema.safeParse({name:"Local Client",mobile:"2424242424",message:"Please contact me about a property."}).success,false);
  assert.ok(COUNTRY_CALLING_CODES.length>190);
});

test("property details are validated by transaction and property type",()=>{
  const house=applicablePropertyDetails({propertyAge:"new",bedrooms:"3",bathrooms:"2",facing:"East",parking:"true"},"sale","independent-house");assert.equal(house.valid,true);assert.equal(house.details.bedrooms,3);assert.equal("crop_type" in house.details,false);
  const plot=applicablePropertyDetails({facing:"West",fencing:"Wall",electricityConnection:"available",roadAccess:"Blacktop"},"sale","open-plot");assert.equal(plot.valid,true);assert.equal("property_age" in plot.details,false);assert.equal("bedrooms" in plot.details,false);
  const land=applicablePropertyDetails({cropType:"Paddy",soilType:"Black Soil",amountBasis:"per_acre_year",fencing:"Open",electricityConnection:"not_available",roadAccess:"Mud Road"},"rent","agricultural-land");assert.equal(land.valid,true);assert.equal(land.details.amount_basis,"per_acre_year");assert.equal(applicablePropertyDetails({},"lease","agricultural-land").valid,false);
});

test("approved homepage, Contact and NRI content is present without physical-office claims",async()=>{
  const[home,hero,contact,nri,layout,site]=await Promise.all([read("../app/page.tsx"),read("../src/components/hero-slider.tsx"),read("../src/components/public/contact-page.tsx"),read("../app/nri-services-ongole/page.tsx"),read("../app/layout.tsx"),read("../src/config/site.ts")]);
  assert.match(home,/Ongole Real Estate \| Trusted Real Estate Agents in Ongole/);assert.match(hero,/Ongole Real Estate &amp; Trusted Property Agents Since 2002/);assert.match(hero,/Buy, Sell &amp; Rent Plots, Houses and Commercial Properties in Ongole/);assert.match(hero,/real-estate-agents-in-ongole-ongoleproperty\.webp/);
  assert.match(contact,/Talk to Ongole &amp; Prakasam District Property Professionals/);assert.match(contact,/variant="contact"/);assert.match(nri,/ongoleproperty-nri-property-services-process\.png/);assert.match(nri,/variant="nri"/);assert.doesNotMatch(layout,/PostalAddress|streetAddress/);assert.doesNotMatch(site,/4th Lane|Bhagya Nagar/);
});

test("targeted non-Home corrections use the final About image and protected enquiry persistence",async()=>{
  const[about,enquiry,css,guard,footer,navigation]=await Promise.all([read("../src/components/public/about-page.tsx"),read("../app/api/enquiries/route.ts"),read("../app/globals.css"),read("../src/components/numeric-input-guard.tsx"),read("../src/components/site-footer.tsx"),read("../src/components/public-navigation.tsx")]);
  assert.match(about,/prakasam-bhavan-ongole-prakasam-district-real-estate\.webp/);assert.match(about,/Prakasam Bhavan in Ongole, Prakasam District/);assert.match(about,/Ongole &amp; Prakasam District/);assert.match(about,/Local Expertise\. Trusted Experience\. Responsible Property Support\./);assert.doesNotMatch(about,/about-hero-mark|Local knowledge/);
  assert.match(enquiry,/createSupabaseServiceClient/);assert.match(enquiry,/enquiry\.create_failed/);assert.doesNotMatch(enquiry,/createClient\(url, anonKey/);
  assert.match(css,/input\[type=number\].*appearance:textfield/);assert.match(guard,/target\.type==="number"/);
  for(const href of ["/about","/properties-for-sale","/properties-for-rent","/paying-guest","/nri-services-ongole","/agents","/contact"])assert.match(`${navigation}\n${footer}`,new RegExp(href.replaceAll("/","\\/")));
});

test("test, script and SQL-looking property content is rejected before public rendering",()=>{
  for(const value of ["TEST PROPERTY - DELETE AFTER UAT","<script>alert(1)</script>","insert into public.roles values ('x')","Debug: database response"]){assert.equal(propertyContentIsProductionSafe(value),false)}
  for(const value of ["twsttwsttwsttwst","efertgreg grtryhtr","Dummy property"]){assert.equal(propertyTitleIsProductionSafe(value),false)}
  assert.equal(propertyDescriptionIsPublicSafe("A clean residential property with verified local information and normal descriptive content."),true);
  assert.equal(propertyDescriptionIsPublicSafe("Visit https://example.com for more information."),false);
});

test("public listings, details and static slug generation share the production-content safety gate",async()=>{
  const[propertyPublic,pgPublic]=await Promise.all([read("../src/lib/properties/public.ts"),read("../src/lib/pg/public.ts")]);
  for(const source of [propertyPublic,pgPublic]){assert.match(source,/propertyPublicRecordIsSafe/);assert.match(source,/getPublic.*Slugs/)}
  assert.match(propertyPublic,/select\("slug,published_at,title,description"\)/);
  assert.match(pgPublic,/select\("pg_name,properties!inner\(slug,published_at,status,deleted_at,description\)"\)/);
});
