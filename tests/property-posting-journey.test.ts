import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("server-authenticated visitors continue the public property posting flow directly",async()=>{
  const[page,workflow]=await Promise.all([read("../app/post-property/page.tsx"),read("../src/components/property-posting-workflow.tsx")]);
  assert.match(page,/getUser\(\)/);
  assert.match(page,/isAuthenticated=Boolean\(auth\.user\)/);
  assert.match(page,/isAuthenticated=\{isAuthenticated\}/);
  assert.match(workflow,/if\(!isAuthenticated\)[\s\S]*\/login\?returnTo=/);
  assert.match(workflow,/fetch\("\/api\/properties",\{method:"POST"/);
  assert.match(workflow,/\/post-property\?transaction=\$\{initialTransaction\}&resume=1/);
  assert.match(workflow,/Save & Continue to Photos/);
});

test("email and Google authentication retain safe property-posting return paths",async()=>{
  const[login,register,registration,google,auth,callback,session]=await Promise.all([
    read("../app/login/page.tsx"),read("../app/register/page.tsx"),read("../src/components/registration-form.tsx"),
    read("../src/components/google-oauth-button.tsx"),read("../app/api/auth/[action]/route.ts"),read("../app/auth/callback/route.ts"),read("../src/lib/auth/session.ts"),
  ]);
  for(const source of [login,register,auth,callback])assert.match(source,/safeReturnPath/);
  assert.match(registration,/name="returnTo" value=\{returnTo\}/);
  assert.match(google,/body:JSON\.stringify\(\{returnTo/);
  assert.match(auth,/emailRedirectTo:[\s\S]*auth\/callback\?next=/);
  assert.match(session,/!value\.startsWith\("\/"\)\|\|value\.startsWith\("\/\/"\)/);
});

test("owner photo management is visible and the final action submits for review",async()=>{
  const[detail,list,workflow,upload]=await Promise.all([
    read("../app/dashboard/properties/[id]/page.tsx"),read("../app/dashboard/properties/page.tsx"),
    read("../src/components/property-posting-workflow.tsx"),read("../app/api/properties/[id]/media/route.ts"),
  ]);
  assert.match(detail,/Upload Property Photos/);
  assert.match(detail,/media=(?:failed\|invalid\|limit)|invalid:"Choose 1 to 6 valid[\s\S]*/);
  assert.match(detail,/property-final-step/);
  assert.match(workflow,/Submit Your Property/);
  assert.match(list,/from\("property_media"\)/);
  assert.match(list,/createSignedUrls/);
  assert.match(list,/dashboard-property-thumb/);
  for(const marker of ["DISPLAY_WIDTH = 1200","DISPLAY_HEIGHT = 800","THUMB_WIDTH = 600","THUMB_HEIGHT = 400","www.ongoleproperty.com , call : 7788998459","processing_status: \"ready\"","storedPaths","storedIds"])assert.ok(upload.includes(marker),marker);
  assert.match(upload,/context: isPg \? "pg" : "property"/);
});

test("media upload uses multipart POST without navigating to the POST-only API",async()=>{
  const[workflow,detail,upload]=await Promise.all([
    read("../src/components/property-posting-workflow.tsx"),read("../app/dashboard/properties/[id]/page.tsx"),read("../app/api/properties/[id]/media/route.ts"),
  ]);
  assert.match(workflow,/fetch\(`\/api\/properties\/\$\{propertyId\}\/media`,\{method:"POST",headers:\{accept:"application\/json"\},body,redirect:"error"\}\)/);
  assert.doesNotMatch(workflow,/upload\.url|window\.location\.assign\(`?\/api\/properties\/\$\{[^}]+\}\/media/);
  assert.match(detail,/<form className="media-upload" action=\{`\/api\/properties\/\$\{id\}\/media`\} method="post" encType="multipart\/form-data">/);
  assert.match(detail,/<button className="button secondary" type="submit">Upload Property Photos<\/button>/);
  assert.match(upload,/export async function POST/);
  assert.doesNotMatch(upload,/export async function GET/);
  assert.match(upload,/request\.headers\.get\("accept"\)\?\.includes\("application\/json"\)/);
  assert.match(upload,/redirectTo: `\$\{destination\.pathname\}\$\{destination\.search\}`/);
  assert.match(upload,/NextResponse\.redirect\(destination, 303\)/);
  for(const result of ["uploaded","invalid","limit","failed"])assert.match(upload,new RegExp(`mediaResponse\\(request, id, "${result}"`));
});

test("property photo selectors explain the two-photo batch guidance",async()=>{
  const[workflow,detail]=await Promise.all([
    read("../src/components/property-posting-workflow.tsx"),read("../app/dashboard/properties/[id]/page.tsx"),
  ]);
  const note="Note: You can upload a maximum of 2 photos at a time. To add more photos, upload them in separate batches. Maximum 6 photos per property.";
  for(const source of [workflow,detail])assert.ok(source.includes(note));
  assert.match(workflow,/type="file"[^>]*\/><small className="form-note">Note: You can upload a maximum of 2 photos at a time\./);
  assert.match(detail,/type="file"[^>]*\/><\/label><p className="form-note">Note: You can upload a maximum of 2 photos at a time\./);
});
