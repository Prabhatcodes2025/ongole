import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {pgDraftSchema} from "../src/lib/pg/validation";
import {PG_CATEGORIES} from "../src/types/pg";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("approved About, Contact and navigation content replaces legacy public copy",async()=>{
  const[home,about,contact,footer,navigation,slugPage,siteConfig]=await Promise.all([
    read("../app/page.tsx"),read("../src/components/public/about-page.tsx"),read("../src/components/public/contact-page.tsx"),
    read("../src/components/site-footer.tsx"),read("../src/components/public-navigation.tsx"),read("../app/[slug]/page.tsx"),read("../src/config/site.ts")
  ]);
  for(const source of [home,about,footer,slugPage])assert.doesNotMatch(source,/Kosana Associates/i);
  for(const marker of ["Who we are","What we do","Property Tracing","NRI Property Services","siteConfig.nriEmail"])assert.match(about,new RegExp(marker.replace(".","\\.")));
  for(const marker of ["siteConfig.email","siteConfig.salesEmail","siteConfig.nriEmail","EnquiryForm","Our Service Area","variant=\"contact\""])assert.match(contact,new RegExp(marker.replace(".","\\.")));
  assert.doesNotMatch(contact,/Open location in Google Maps|physical office address|4th Lane/i);
  for(const address of ["enquiry@ongoleproperty.com","sales@ongoleproperty.com","nri@ongoleproperty.com"])assert.match(siteConfig,new RegExp(address.replace(".","\\.")));
  assert.doesNotMatch(contact,/admin@ongoleproperty\.com/i);
  for(const href of ["/about","/contact","/agents","/nri-services-ongole","/privacy-policy","/contact-grievance-policy"])assert.match(footer,new RegExp(href.replaceAll("/","\\/")));
  assert.match(navigation,/aria-current/);
});

test("NRI page is canonical, uses supplied imagery, structured data and approved workflow",async()=>{
  const[page,pricing,sitemap]=await Promise.all([read("../app/nri-services-ongole/page.tsx"),read("../app/pricing/page.tsx"),read("../app/sitemap.ts")]);
  for(const marker of ["nri-family-consultation.webp","property-tracing-survey.webp","ongoleproperty-nri-property-services-process.png","Exclusive Property Tracing","FAQPage","siteConfig.nriEmail","variant=\"nri\""])assert.match(page,new RegExp(marker.replace(".","\\.")));
  assert.doesNotMatch(page,/15–20 working days|fixed timeline|guaranteed tracing/i);
  assert.match(page,/canonical:\s*"\/nri-services-ongole"/);
  assert.match(pricing,/permanentRedirect\("\/nri-services-ongole"\)/);
  assert.match(sitemap,/nri-services-ongole/);
  assert.doesNotMatch(sitemap,/path:\s*"\/pricing"/);
});

test("agent applications are pending, reviewable and permission protected",async()=>{
  const[form,auth,admin,api,migration]=await Promise.all([
    read("../src/components/registration-form.tsx"),read("../app/api/auth/[action]/route.ts"),read("../app/admin/agents/page.tsx"),
    read("../app/api/admin/agents/[id]/review/route.ts"),read("../supabase/migrations/202608090001_client_public_site_alignment.sql")
  ]);
  for(const marker of ["Years of experience","Office address","Working towns","Specialisations","profile remains pending"])assert.match(form,new RegExp(marker));
  assert.match(auth,/working_towns:list\(parsed\.data\.workingTowns,5\)/);
  assert.match(admin,/agents\.read/);
  assert.match(api,/agents\.manage/);
  for(const marker of ["review_agent_application","'pending'","invalid_transition","agent.'||review_action"])assert.match(migration,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(migration,/grant\s+(?:insert|update|delete)[^;]+\s+to\s+anon/i);
});

test("locked PG requirements are enforced in validation, uploads and database",async()=>{
  assert.deepEqual([...PG_CATEGORIES],["mens","womens","co_living"]);
  const base={pg_name:"Sri Sai Residency",category:"mens",locality:"Ongole",city:"Ongole",district:"Prakasam",state:"Andhra Pradesh",rent_per_bed:6500,amenities:[],house_rules:[],video_urls:[],description:"Clean accommodation near the town centre.",address_line:"Ongole"};
  assert.equal(pgDraftSchema.safeParse(base).success,true);
  for(const description of ["Call 9988767689 today","Visit https://example.com","Follow us @bestpg","Limited offer book now","This is shit advertising"]){
    assert.equal(pgDraftSchema.safeParse({...base,description}).success,false);
  }
  assert.equal(pgDraftSchema.safeParse({...base,video_urls:["https://example.com/video"]}).success,false);
  assert.equal(pgDraftSchema.safeParse({...base,video_urls:["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]}).success,true);

  const[upload,owner,publicService,list,detail,migration]=await Promise.all([
    read("../app/api/properties/[id]/media/route.ts"),read("../app/dashboard/pg/[id]/page.tsx"),read("../src/lib/pg/public.ts"),
    read("../app/paying-guest/page.tsx"),read("../app/paying-guest/[slug]/page.tsx"),read("../supabase/migrations/202608090001_client_public_site_alignment.sql")
  ]);
  for(const marker of ["www.ongoleproperty.com | 7788998459","hardLimit=isPg?6:20","webp"])assert.match(upload,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(owner,/Select the cover image after upload/);
  assert.match(publicService,/paidOwners/);
  assert.match(publicService,/contactLabel:entitled/);
  for(const source of [list,detail])assert.doesNotMatch(source,/security_deposit|<dt>Security Deposit|<h2>Security Deposit|room sharing|family PG/i);
  assert.match(detail,/ClickToLoadMap/);
  for(const marker of ["pg_description_prohibited_content","invalid_pg_video_url","pg_image_limit_reached","set search_path = public, pg_temp"])assert.match(migration,new RegExp(marker));
});
