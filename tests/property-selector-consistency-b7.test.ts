import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PropertyPostingFields} from "../src/components/property-posting-fields";
import {fallbackPropertyCatalog} from "../src/config/property-catalog";

test("Category and Property Type share the same selector structure",()=>{
  const html=renderToStaticMarkup(createElement(PropertyPostingFields,{catalog:fallbackPropertyCatalog,defaults:{transactionType:"sale",category:"residential",propertyType:"villa"}}));
  assert.match(html,/<fieldset class="property-selector-grid">/);
  assert.equal((html.match(/class="property-selector-field"/g)||[]).length,2);
  assert.equal((html.match(/class="property-selector-control"/g)||[]).length,2);
  assert.match(html,/name="category"[^>]*class="property-selector-control"|class="property-selector-control"[^>]*name="category"/);
  assert.match(html,/name="propertyType"[^>]*class="property-selector-control"|class="property-selector-control"[^>]*name="propertyType"/);
});

test("Rent and Lease keep the searchable custom property type input",()=>{
  for(const transactionType of ["rent","lease"]){
    const html=renderToStaticMarkup(createElement(PropertyPostingFields,{catalog:fallbackPropertyCatalog,defaults:{transactionType,category:"residential",propertyType:"Custom Home"}}));
    const propertyTypeInput=html.match(/<input[^>]*name="propertyType"[^>]*>/)?.[0]||"";
    assert.match(propertyTypeInput,/class="property-selector-control"/);
    assert.match(propertyTypeInput,/list="rent-property-types"/);
    assert.match(html,/<datalist id="rent-property-types">/);
    assert.match(html,/Select a suggestion or enter a custom property type\./);
    assert.match(html,/value="Custom Home"/);
  }
});

test("selector styles align sizing, states and responsive layout",async()=>{
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/\.submission-form \.property-selector-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-items:start;gap:14px\}/);
  assert.match(css,/\.submission-form \.property-selector-field\{[^}]*grid-template-rows:auto 48px;[^}]*gap:8px/);
  assert.match(css,/\.submission-form \.property-selector-control\{[^}]*height:48px;min-height:48px;[^}]*border-radius:8px;[^}]*font-size:\.9rem;[^}]*font-weight:650/);
  assert.match(css,/\.property-selector-control:hover\{border-color:/);
  assert.match(css,/\.property-selector-field\[data-selected=true\] \.property-selector-control\{border-color:/);
  assert.match(css,/\.property-selector-control:focus-visible\{[^}]*box-shadow:/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/\.submission-form \.property-selector-grid\{grid-template-columns:1fr\}/);
});
