import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("Google OAuth starts with guarded navigation and retains the strict form CSP",async()=>{
  const[button,login,registration,headers]=await Promise.all([
    read("../src/components/google-oauth-button.tsx"),read("../app/login/page.tsx"),read("../src/components/registration-form.tsx"),read("../next.config.ts"),
  ]);
  assert.match(headers,/form-action 'self'/);
  assert.doesNotMatch(login,/form[^>]+action="\/api\/auth\/google"/);
  assert.doesNotMatch(registration,/form[^>]+action="\/api\/auth\/google"/);
  assert.match(button,/startingRef\.current/);
  assert.match(button,/window\.location\.assign\(`\/api\/auth\/google\?/);
});

test("Google OAuth GET preserves callback destination and the existing Supabase session flow",async()=>{
  const[route,callback]=await Promise.all([read("../app/api/auth/[action]/route.ts"),read("../app/auth/callback/route.ts")]);
  assert.match(route,/export async function GET/);
  assert.match(route,/signInWithOAuth\(\{provider:"google"/);
  assert.match(route,/callback\.searchParams\.set\("next",returnTo\)/);
  assert.match(callback,/exchangeCodeForSession/);
  assert.match(callback,/NextResponse\.redirect\(new URL\(`\$\{next\}/);
  assert.match(route,/if \(action === "logout"\)/);
});
