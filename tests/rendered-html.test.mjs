import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the standard Next.js production runtime", async () => {
  const [packageJson, layout, homepage, nextConfig] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(packageJson);
  assert.equal(manifest.scripts.build, "next build");
  assert.equal(manifest.scripts.start, "next start");
  assert.equal(manifest.scripts.dev, "next dev");
  assert.equal(manifest.devDependencies.vinext, undefined);
  assert.equal(manifest.devDependencies.wrangler, undefined);
  assert.match(layout, /OngoleProperty\.com/);
  assert.match(homepage, /Find the right property/);
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.doesNotMatch(packageJson, /cloudflare|vinext|wrangler|rolldown|workerd/i);
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
