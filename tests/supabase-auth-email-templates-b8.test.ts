import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("production auth redirects use the OngoleProperty domain",async()=>{
  const[environment,example,auth,site]=await Promise.all([
    read("../src/lib/env.ts"),
    read("../.env.example"),
    read("../app/api/auth/[action]/route.ts"),
    read("../src/config/site.ts"),
  ]);
  assert.match(environment,/process\.env\.NODE_ENV === "production" \? "https:\/\/ongoleproperty\.com" : "http:\/\/localhost:3000"/);
  assert.match(example,/^NEXT_PUBLIC_SITE_URL=https:\/\/ongoleproperty\.com$/m);
  assert.match(site,/process\.env\.NEXT_PUBLIC_SITE_URL \|\| "https:\/\/ongoleproperty\.com"/);
  assert.match(auth,/emailRedirectTo: `\$\{env\.siteUrl\}\/auth\/callback/);
  assert.ok(auth.includes('const resetUrl=`${env.siteUrl.replace(/\\/$/,"")}/reset-password`'));
  assert.doesNotMatch(auth,/https:\/\/[^"'`]*\.supabase\.co/i);
});

test("PKCE recovery remains a single server-side code exchange",async()=>{
  const[recovery,page,form,proxy]=await Promise.all([
    read("../app/auth/recovery/route.ts"),
    read("../app/reset-password/page.tsx"),
    read("../src/components/reset-password-form.tsx"),
    read("../proxy.ts"),
  ]);
  assert.equal((recovery.match(/exchangeCodeForSession\(code\)/g)||[]).length,1);
  assert.match(recovery,/response\.cookies\.set/);
  assert.match(recovery,/redirectType!=="PASSWORD_RECOVERY"/);
  assert.match(page,/query\.code\)redirect\(`\/auth\/recovery\?code=/);
  assert.doesNotMatch(form,/exchangeCodeForSession|verifyOtp|supabase\.auth\.setSession/);
  assert.match(proxy,/path==="\/reset-password"\|\|path==="\/auth\/recovery"/);
});

test("required Supabase Auth templates are branded and token-safe",async()=>{
  const[confirmSubject,resetSubject,confirmHtml,resetHtml]=await Promise.all([
    read("../supabase/email-templates/confirm-signup.subject.txt"),
    read("../supabase/email-templates/reset-password.subject.txt"),
    read("../supabase/email-templates/confirm-signup.html"),
    read("../supabase/email-templates/reset-password.html"),
  ]);
  assert.equal(confirmSubject.trim(),"Verify your email | OngoleProperty.com");
  assert.equal(resetSubject.trim(),"Reset your password | OngoleProperty.com");
  for(const html of [confirmHtml,resetHtml]){
    assert.match(html,/OngoleProperty\.com/);
    assert.ok((html.match(/\{\{ \.ConfirmationURL \}\}/g)||[]).length>=3);
    assert.match(html,/If (?:you did not|the button does not work)/);
    assert.match(html,/admin@ongoleproperty\.com/);
    assert.doesNotMatch(html,/<script|javascript:|access_token|token_hash|\?code=/i);
  }
  assert.match(confirmHtml,/>Verify email<\/a>/);
  assert.match(resetHtml,/>Reset password<\/a>/);
});

test("SMTP and dashboard setup remain manual and secrets stay server-only",async()=>{
  const[documentation,example,environment,google]=await Promise.all([
    read("../docs/supabase-auth-email-setup.md"),
    read("../.env.example"),
    read("../src/lib/env.ts"),
    read("../src/components/google-oauth-button.tsx"),
  ]);
  for(const value of ["Custom SMTP","SMTP Host","SMTP Port","SMTP Username","SMTP Password","SPF","DKIM","DMARC","Authentication → Email Templates"])
    assert.ok(documentation.includes(value),`Missing setup instruction: ${value}`);
  assert.match(documentation,/Site URL: `https:\/\/ongoleproperty\.com`/);
  assert.match(documentation,/Redirect URL: `https:\/\/ongoleproperty\.com\/reset-password`/);
  assert.match(documentation,/email-change, magic-link, or email-OTP/);
  assert.doesNotMatch(`${example}\n${environment}`,/NEXT_PUBLIC_(?:SMTP|.*SMTP|.*SECRET|SUPABASE_SERVICE_ROLE)/);
  assert.match(environment,/process\.env\.SMTP_PASSWORD/);
  assert.match(google,/signInWithIdToken/);
});
