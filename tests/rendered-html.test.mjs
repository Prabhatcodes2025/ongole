import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the production OngoleProperty homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>OngoleProperty\.com \| Trusted Real Estate Since 2002<\/title>/i);
  assert.match(html, /Find the right property/);
  assert.match(html, /Manual[^<]*listing verification/);
  assert.match(html, /ongole-property-logo\.png/);
  assert.match(html, /rel="canonical" href="https:\/\/www\.ongoleproperty\.com\/"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps media private and property publication manually controlled", async () => {
  const [core, storage, mediaRoute] = await Promise.all([
    readFile(new URL("../supabase/migrations/202607160001_core_schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607160002_property_media_storage.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/properties/[id]/media/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(core, /alter table public\.properties enable row level security/i);
  assert.match(core, /create or replace function public\.review_property/i);
  assert.match(core, /get_property_contact/i);
  assert.match(storage, /'property-media', 'property-media', false/i);
  assert.match(storage, /property_media_owner_insert/i);
  assert.match(mediaRoute, /limitInputPixels:\s*40_000_000/);
  assert.match(mediaRoute, /\.webp\(\{ quality:/);
  assert.match(mediaRoute, /ONGOLEPROPERTY\.COM/);
  assert.doesNotMatch(mediaRoute, /serviceRole|SUPABASE_SERVICE_ROLE_KEY/);
});
