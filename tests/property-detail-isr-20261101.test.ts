import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("property detail keeps ISR and public data independent of request cookies",async()=>{
  const[page,properties,header]=await Promise.all([read("../app/property/[slug]/page.tsx"),read("../src/lib/properties/public.ts"),read("../src/components/site-header.tsx")]);
  assert.match(page,/export const revalidate=300/);
  assert.match(page,/generateStaticParams/);
  assert.match(page,/generateMetadata/);
  assert.match(properties,/\.in\("status", \["published","expired"\]\)\.is\("deleted_at", null\)/);
  assert.doesNotMatch(page+properties+header,/createSupabaseServerClient|from "next\/headers"|cookies\(|headers\(/);
});
