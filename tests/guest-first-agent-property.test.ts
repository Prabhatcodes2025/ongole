import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("agent guest application captures identity and all supported application fields before authentication",()=>{
 const form=read("../src/components/agent-application-prefill.tsx"),registration=read("../src/components/registration-form.tsx"),submit=read("../src/components/agent-application-submit.tsx");
 for(const field of ['name="name"','name="mobile"','name="email"','name="yearsExperience"','name="workingTowns"','name="officeAddress"','name="specializations"','name="about"'])assert.ok(form.includes(field),`missing guest field ${field}`);
 assert.ok(form.includes("localStorage.setItem(AGENT_DRAFT_KEY"));assert.ok(form.includes("Continue to Sign In / Register"));
 assert.ok(registration.includes("localStorage.getItem(AGENT_DRAFT_KEY"));assert.ok(registration.includes("value={isAgent?agentDraft.name:undefined}"));
 assert.ok(registration.includes('updateAgentDraft("workingTowns"'));assert.ok(registration.includes("localStorage.setItem(AGENT_DRAFT_KEY"));
 assert.ok(submit.includes("/api/agents/application"));assert.ok(submit.includes("localStorage.removeItem(AGENT_DRAFT_KEY)"));
});

test("agent application writes require authenticated matching profile and preserve one private pending application",()=>{
 const api=read("../app/api/agents/application/route.ts");
 assert.ok(api.includes("supabase.auth.getUser()"));assert.ok(api.includes("profile.account_type!==\"agent\""));
 assert.ok(api.includes("profile.mobile"));assert.ok(api.includes("profile.email"));assert.ok(api.includes("profile.full_name"));
 assert.ok(api.includes(".update({years_experience"));assert.ok(api.includes("status!==\"pending\""));assert.ok(api.includes("if(!existing)"));
});

test("sale and rent drafts persist through refresh and keep photos in IndexedDB for authenticated upload",()=>{
 const property=read("../src/components/property-posting-workflow.tsx");
 for(const marker of ["localStorage.setItem(STORAGE_KEY","MAX_AGE_MS","savePropertyDraft(values)","readPropertyDraft()","transactionType","indexedDB","pending-property","readGuestMedia()","/api/properties/${result.id}/media"])assert.ok(property.includes(marker),`missing property restoration contract ${marker}`);
 assert.ok(property.includes("initialTransaction"));assert.ok(property.includes("Continue to Sign In / Register"));
});

test("PG guest-first persistence, photo handoff and authenticated submission remain present",()=>{
 const pg=read("../src/components/pg-posting-workflow.tsx");
 for(const marker of ["ongoleproperty.pending-pg","saveDraft(values)","indexedDB","pending-pg","/api/auth/context","/api/pg","/api/properties/${result.propertyId}/media","clearDraft()"])assert.ok(pg.includes(marker),`missing PG flow marker ${marker}`);
});
