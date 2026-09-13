import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ProfileMobileForm} from "../src/components/profile-mobile-form";
import {isValidIndianMobile} from "../src/lib/auth/mobile";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("property-posting profile completion shows a safe inline mobile error",()=>{
  const html=renderToStaticMarkup(createElement(ProfileMobileForm,{completing:true,returnTo:"/dashboard/properties/new?restore=1",initialError:"invalid_mobile",profile:null}));
  assert.match(html,/Please enter a valid 10-digit mobile number\./);
  const mobileInput=html.match(/<label>Mobile<input([^>]+)>/)?.[1]||"";
  assert.match(mobileInput,/name="mobile"/);
  assert.match(mobileInput,/aria-invalid="true"/);
  assert.match(html,/id="profile-mobile-error"/);
  assert.doesNotMatch(html,/\{"error"|Supabase|stack trace/);
});

test("mobile guard keeps invalid, repeated, and sequential numbers out",()=>{
  assert.equal(isValidIndianMobile("9876501234"),true);
  for(const mobile of ["98765","5876501234","9999999999","9876543210","1212121212"]){assert.equal(isValidIndianMobile(mobile),false)}
});

test("profile POST retains server validation and never sends native form submissions to raw JSON",async()=>{
  const[route,form]=await Promise.all([read("../app/api/profile/route.ts"),read("../src/components/profile-mobile-form.tsx")]);
  assert.match(route,/refine\(\(value\)=>value===""\|\|isValidIndianMobile\(value\)\)/);
  assert.match(route,/parsed\.error\.issues\.some\(issue=>issue\.path\[0\]==="mobile"\)/);
  assert.match(route,/if\(wantsJson\)return NextResponse\.json\(\{error:code\}/);
  assert.match(route,/return NextResponse\.redirect\(url,303\)/);
  assert.match(form,/headers:\{accept:"application\/json"\}/);
  assert.doesNotMatch(form,/setMessage\(result\.(?:error|message)/);
});
