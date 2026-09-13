import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {registrationErrorCode} from "../src/lib/auth/registration";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("password recovery lands directly on reset-password and confirms the new password",async()=>{
  const[route,page,form,proxy]=await Promise.all([read("../app/api/auth/[action]/route.ts"),read("../app/reset-password/page.tsx"),read("../src/components/reset-password-form.tsx"),read("../proxy.ts")]);
  assert.match(route,/resetPasswordForEmail\(email,\{redirectTo:resetUrl\}\)/);
  assert.match(route,/\/reset-password/);
  assert.match(page,/ResetPasswordForm/);
  assert.match(form,/Confirm Password/);
  assert.match(form,/exchangeCodeForSession/);
  assert.match(form,/verifyOtp/);
  assert.match(proxy,/path==="\/reset-password"/);
  assert.match(proxy,/path==="\/api\/auth\/update-password"/);
});

test("registration errors are actionable without exposing provider details",()=>{
  assert.equal(registrationErrorCode({code:"user_already_exists"}),"account_exists");
  assert.equal(registrationErrorCode({code:"email_address_invalid"}),"invalid_email");
  assert.equal(registrationErrorCode({code:"weak_password"}),"password_weak");
  assert.equal(registrationErrorCode({status:429}),"rate_limited");
  assert.equal(registrationErrorCode({message:"Database error saving new user"}),"registration_failed");
});

test("named dashboard routes share request-scoped auth and keep bounded payloads",async()=>{
  const[context,shell,overview,properties,enquiries,analytics,billing]=await Promise.all([read("../src/lib/dashboard/context.ts"),read("../src/components/dashboard/dashboard-shell.tsx"),read("../app/dashboard/page.tsx"),read("../app/dashboard/properties/page.tsx"),read("../app/dashboard/enquiries/page.tsx"),read("../app/dashboard/analytics/page.tsx"),read("../app/dashboard/billing/page.tsx")]);
  assert.match(context,/cache\(async/);
  for(const source of [shell,overview,properties,enquiries,analytics,billing])assert.match(source,/getDashboardAuth/);
  assert.doesNotMatch(billing,/from\("plans"\)\.select\("\*"\)/);
  assert.match(overview,/Promise\.all/);
});
