import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("property and PG listings use Priority Listing presentation text",async()=>{
  const sources=await Promise.all([
    read("../src/components/property-card.tsx"),
    read("../app/property/[slug]/page.tsx"),
    read("../app/paying-guest/page.tsx"),
    read("../app/paying-guest/[slug]/page.tsx"),
    read("../src/components/public-property-listing-page.tsx"),
  ]);
  const presentation=sources.join("\n");
  assert.match(presentation,/Priority Listing/);
  assert.doesNotMatch(presentation,/>Verified</);
  assert.doesNotMatch(presentation,/Verified property discovery/);
  assert.match(presentation,/pg\.verified&&<span className="badge">Priority Listing<\/span>/);
});

test("property metadata uses the new listing terminology",async()=>{
  const sources=await Promise.all([
    read("../src/config/site.ts"),
    read("../app/[slug]/page.tsx"),
    read("../app/properties-for-sale/page.tsx"),
    read("../app/properties-for-rent/page.tsx"),
  ]);
  const metadata=sources.join("\n");
  assert.match(metadata,/Priority Listings/);
  assert.doesNotMatch(metadata,/verified propert(?:y|ies)/i);
});

test("admin listing controls and allowances use Priority Listing labels",async()=>{
  const sources=await Promise.all([
    read("../app/admin/properties/page.tsx"),
    read("../app/admin/properties/[id]/page.tsx"),
    read("../app/admin/pg/page.tsx"),
    read("../app/admin/pg/[id]/page.tsx"),
    read("../app/admin/billing/plans/page.tsx"),
    read("../app/admin/billing/plans/[id]/page.tsx"),
  ]);
  const admin=sources.join("\n");
  assert.match(admin,/Any Priority Listing status/);
  assert.match(admin,/Mark as Priority Listing/);
  assert.match(admin,/Remove Priority Listing/);
  assert.match(admin,/Priority Listing allowance/);
  assert.doesNotMatch(admin,/Any verification|Not verified|Verify property|Remove verification|Verified allowance/);
});

test("promotion UI translates legacy verified products without changing internal values",async()=>{
  const [dashboard,admin,button,migration]=await Promise.all([
    read("../app/dashboard/promotions/page.tsx"),
    read("../app/admin/promotions/page.tsx"),
    read("../src/components/billing/promotion-claim-button.tsx"),
    read("../supabase/migrations/202607280001_sprint5_memberships_monetization.sql"),
  ]);
  assert.match(dashboard,/type==="verified"\?"Priority Listing"/);
  assert.match(admin,/<option value="verified">Priority Listing<\/option>/);
  assert.match(button,/promotionType:"featured"\|"verified"/);
  assert.match(button,/promotionType==="verified"\?"Priority Listing":promotionType/);
  assert.match(migration,/\('Verified Property','verified-property','verified'/);
});

test("internal fields and account and agent verification wording remain intact",async()=>{
  const [properties,plans,account,agents]=await Promise.all([
    read("../app/admin/properties/page.tsx"),
    read("../app/admin/billing/plans/page.tsx"),
    read("../src/components/account-deactivation-form.tsx"),
    read("../src/components/public/agents-page.tsx"),
  ]);
  assert.match(properties,/params\.verified==="yes"/);
  assert.match(properties,/query\.eq\("is_verified",true\)/);
  assert.match(properties,/\["verify","Mark as Priority Listing"\]/);
  assert.match(plans,/name="verified_listing_allowance"/);
  assert.match(account,/Verified email/);
  assert.match(agents,/Verified Agent Network\./);
});
