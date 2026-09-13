import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("Google GIS uses a guarded ID-token exchange and permits only required Google origins",async()=>{
  const[button,login,registration,headers]=await Promise.all([
    read("../src/components/google-oauth-button.tsx"),read("../app/login/page.tsx"),read("../src/components/registration-form.tsx"),read("../next.config.ts"),
  ]);
  assert.match(headers,/form-action 'self'/);
  assert.doesNotMatch(login,/form[^>]+action="\/api\/auth\/google"/);
  assert.doesNotMatch(registration,/form[^>]+action="\/api\/auth\/google"/);
  assert.match(button,/startingRef\.current/);
  assert.match(button,/signInWithIdToken\(\{provider:"google",token:response\.credential\}\)/);
  assert.match(button,/renderButton/);
  assert.match(button,/NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
  assert.match(headers,/https:\/\/accounts\.google\.com/);
});

test("Google GIS completion preserves profile, reactivation and session controls",async()=>{
  const[route,callback]=await Promise.all([read("../app/api/auth/[action]/route.ts"),read("../app/auth/callback/route.ts")]);
  assert.doesNotMatch(route,/signInWithOAuth/);
  assert.match(route,/claim_new_google_account/);
  assert.match(route,/reactivate_current_account/);
  assert.match(route,/setSessionControlCookies/);
  assert.match(route,/dashboard\/profile\?complete=1/);
  assert.match(callback,/exchangeCodeForSession/);
  assert.match(route,/if \(action === "logout"\)/);
});
