import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("all required legal policies are routed, canonical, linked, and indexed",async()=>{
  const[content,pages,footer,sitemap]=await Promise.all([read("../app/[slug]/page.tsx"),read("../src/content/legal-pages.ts"),read("../src/components/site-footer.tsx"),read("../app/sitemap.ts")]);
  const slugs=["privacy-policy","terms-and-conditions","disclaimer","property-listing-policy","membership-policy","advertisement-policy","cookie-policy","copyright-policy","contact-grievance-policy"];
  for(const slug of slugs){
    assert.match(pages,new RegExp(`(?:\\"${slug}\\"|\\b${slug}:)`));
    assert.match(footer,new RegExp(`/${slug}`));
    assert.match(sitemap,new RegExp(`/${slug}`));
  }
  assert.match(content,/resolveLegalPage/);
  assert.match(content,/legal\.canonical/);
  assert.match(content,/Effective:/);
  assert.match(footer,/aria-label="Legal policies"/);
});

test("hero is compact and provides controllable, reduced-motion-safe rotation",async()=>{
  const[slider,styles]=await Promise.all([read("../src/components/hero-slider.tsx"),read("../app/globals.css")]);
  assert.match(slider,/matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(slider,/paused\|\|reducedMotion/);
  assert.match(slider,/Pause automatic slide rotation/);
  assert.match(slider,/role="tabpanel"/);
  assert.match(styles,/\.hero-slider\{min-height:700px\}/);
  assert.ok(styles.lastIndexOf(".hero-slider{min-height:700px}")>styles.lastIndexOf(".hero-slider{min-height:900px}"));
});

test("non-functional favorites are removed and dialog focus is managed",async()=>{
  const[actions,gallery]=await Promise.all([read("../src/components/property-actions.tsx"),read("../src/components/property-gallery.tsx")]);
  assert.doesNotMatch(actions,/Favorites dashboard|<Bookmark|Sign in to save/);
  assert.match(actions,/aria-live="polite"/);
  assert.match(gallery,/aria-modal="true"/);
  assert.match(gallery,/closeButton\.current\?\.focus/);
  assert.match(gallery,/trigger\?\.focus/);
  assert.match(gallery,/event\.key==="Tab"/);
});
