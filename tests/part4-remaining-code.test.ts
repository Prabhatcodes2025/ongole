import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {facingOptions} from "../src/config/property-catalog";
import {applicablePropertyDetails} from "../src/lib/properties/validation";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("Sale Rent stay watermarked while PG uses optimized watermark-free images",async()=>{
  const source=await read("../app/api/properties/[id]/media/route.ts");
  for(const marker of ["files.length>6","const limit=6","width:1200","width:400","www.ongoleproperty.com Call 7788998459","context\")===\"pg\"","isPg?baseImage:baseImage.composite","quality:isPg?88:82"])assert.match(source,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(source,/property-media/);
});

test("public detail routes expose only published and expired listings",async()=>{
  const[properties,pg,card,pgPage,lifecycle]=await Promise.all([read("../src/lib/properties/public.ts"),read("../src/lib/pg/public.ts"),read("../src/components/property-card.tsx"),read("../app/paying-guest/page.tsx"),read("../supabase/migrations/202609060002_property_posting_workflow.sql")]);
  assert.match(properties,/\.in\("status", \["published","expired"\]\)/);
  assert.match(pg,/\.in\("properties\.status",\["published","expired"\]\)/);
  assert.match(pg,/property\.status==="published"&&/);
  assert.match(card,/href={`\/property\/\$\{property\.slug\}`}[^>]*>View More Details/);
  assert.match(pgPage,/href={`\/paying-guest\/\$\{pg\.slug\}`}/);
  assert.match(lifecycle,/review_action='publish' and old_status<>'approved'/);
  assert.match(lifecycle,/expires_at=case when review_action in \('publish','renew'\) then now\(\)\+interval '1 month'/);
});

test("Open Plot uses land area and agricultural sale price basis",async()=>{
  const valid=applicablePropertyDetails({amountBasis:"per_acre",facing:"North",fencing:"Open",electricityConnection:"available",roadAccess:"Blacktop"},"sale","open-plot");
  assert.equal(valid.valid,true);
  assert.equal(valid.details.amount_basis,"per_acre");
  assert.equal(applicablePropertyDetails({facing:"North",fencing:"Open",electricityConnection:"available",roadAccess:"Blacktop"},"sale","open-plot").valid,false);
  const form=await read("../src/components/property-posting-fields.tsx");
  for(const marker of ["usesSaleLandPricing","Sale price basis","Choose basis","Per Acre","Asking Price","Land\":isPlot","price-area-grid"])assert.match(form,new RegExp(marker));
});

test("guest Sale and Rent continuation preserves transaction and prevents duplicate drafts",async()=>{
  const[workflow,create,login,register]=await Promise.all([read("../src/components/property-posting-workflow.tsx"),read("../app/api/properties/route.ts"),read("../app/login/page.tsx"),read("../app/register/page.tsx")]);
  assert.match(workflow,/sessionStorage\.setItem\(STORAGE_KEY,JSON\.stringify\(values\)\)/);
  assert.match(workflow,/setDefaults\(\{\.\.\.parsed,draftKey:parsed\.draftKey\|\|draftKey\(\)\}\)/);
  assert.match(create,/client_draft_key:value\.draftKey/);
  assert.match(create,/reused:true/);
  assert.match(login,/register\?returnTo=/);
  assert.match(register,/safeReturnPath\(query\.returnTo\)/);
});

test("facing labels type suggestions and Industrial filtering are exact",async()=>{
  assert.deepEqual(facingOptions,["North","South","East","West","North East","South East","South West","North West"]);
  const[fields,masters,pgValidation]=await Promise.all([read("../src/components/property-posting-fields.tsx"),read("../src/lib/masters/public.ts"),read("../src/lib/pg/validation.ts")]);
  assert.match(fields,/<option key={type\.value} value={type\.label}\/>/);
  assert.doesNotMatch(fields,/value={type\.value} label={type\.label}/);
  assert.match(masters,/category\.slug==="industrial"/);
  assert.match(masters,/type\.slug==="function-hall"/);
  assert.match(pgValidation,/facing:z\.string/);
});

test("contact agent and global WhatsApp content matches Part 4",async()=>{
  const[contact,agents,floating,layout,styles,site]=await Promise.all([read("../src/components/public/contact-page.tsx"),read("../src/components/public/agents-page.tsx"),read("../src/components/floating-whatsapp-controls.tsx"),read("../app/layout.tsx"),read("../app/globals.css"),read("../src/config/site.ts")]);
  for(const number of ["+91 77889 98459","+91 99887 67689"])assert.match(contact,new RegExp(number.replace("+","\\+")));
  for(const copy of ["Join Ongole &amp; Prakasam&apos;s","Verified Agent Network.","Faster Deals.","Verified Agents. Private Network. Faster Deals.","అవకాశాలు — — పంచుకుందాం అనుబంధాలు పెంచుకుందాం కలిసి ఎదుగుదాం."])assert.match(agents,new RegExp(copy));
  assert.doesNotMatch(agents,/Public eligibility|Only verified, active profiles become eligible for public discovery/);
  assert.match(floating,/siteConfig\.whatsappHref/);
  assert.match(site,/919988767689/);
  assert.match(floating,/https:\/\/whatsapp\.com\/channel\/0029Vb9rysWEawdmFYkYMO43/);
  assert.match(floating,/PRIVATE_PREFIXES/);
  assert.equal((layout.match(/<FloatingWhatsAppControls\/>/g)||[]).length,1);
  assert.match(styles,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});
