import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("shared property cards keep all listing content and actions",async()=>{
  const card=await read("../src/components/property-card.tsx");
  for(const marker of ["property.title","formatPropertyPrice","formatLocalArea","property-facts","property-highlights","property.tags","View More Details","badge-row"]){
    assert.match(card,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
});

test("desktop cards are vertically compact without changing the property grid",async()=>{
  const css=await read("../app/globals.css");
  assert.match(css,/\.property-grid \{ display:grid; grid-template-columns:repeat\(3,1fr\); gap:24px; \}/);
  assert.match(css,/\.property-card-grid\{height:100%;display:flex;flex-direction:column\}/);
  assert.match(css,/\.property-card-grid \.property-visual,[^{]+\{height:132px;flex:0 0 132px\}/);
  assert.match(css,/\.property-card-grid \.property-content,[^{]+\{height:auto;min-height:0;flex:1;padding:12px 14px\}/);
  assert.match(css,/\.property-card-grid \.card-footer\{gap:7px;margin-top:auto;padding-top:7px\}/);
});

test("tablet and mobile retain responsive single and two-column layouts",async()=>{
  const css=await read("../app/globals.css");
  assert.match(css,/@media \(max-width:1050px\)[\s\S]*?\.property-grid \{ grid-template-columns:repeat\(2,1fr\); \}/);
  assert.match(css,/@media \(max-width:720px\)[\s\S]*?\.property-grid \{ grid-template-columns:1fr; \}/);
  assert.match(css,/@media\(max-width:900px\)\{\.property-card-grid \.property-visual,[^{]+\{height:142px/);
  assert.match(css,/@media\(max-width:720px\)[\s\S]*?height:165px;flex-basis:165px/);
});
