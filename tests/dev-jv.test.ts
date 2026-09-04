import assert from "node:assert/strict";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PropertyPostingFields} from "../src/components/property-posting-fields";
import {fallbackPropertyCatalog,typesFromCatalog} from "../src/config/property-catalog";
import {formatPropertyPrice,propertyPurposeLabel} from "../src/lib/format";
import {applicablePropertyDetails} from "../src/lib/properties/validation";

const plot={category:"dev-jv",facing:"East",fencing:"Open",electricityConnection:"available",roadAccess:"Concrete"};

test("Dev/JV validates Sale and Open Plot and preserves plot requirements",()=>{
  assert.equal(applicablePropertyDetails(plot,"sale","open-plot").valid,true);
  for(const transaction of ["rent","lease"])
    assert.ok(applicablePropertyDetails(plot,transaction,"open-plot").errors.category);
  for(const type of ["villa","commercial-open-plot","agricultural-land"])
    assert.ok(applicablePropertyDetails(plot,"sale",type).errors.category);
  assert.ok(applicablePropertyDetails({...plot,facing:""},"sale","open-plot").errors.facing);
});

test("saved Dev/JV form reuses price and area controls with only Open Plot",()=>{
  for(const lockIdentity of [false,true]){
    const html=renderToStaticMarkup(createElement(PropertyPostingFields,{catalog:fallbackPropertyCatalog,lockIdentity,defaults:{...plot,transactionType:"sale",propertyType:"open-plot",price:5000000,areaValue:1,areaUnit:"gadi"}}));
    assert.match(html,/Present Market Price/);
    assert.doesNotMatch(html,/Sale price|name="amountBasis"/);
    const priceInput=html.match(/<input[^>]*name="price"[^>]*>/)?.[0]||"";
    for(const attribute of ['class="dev-jv-price"','type="number"','min="0"','value="5000000"'])assert.ok(priceInput.includes(attribute));
    for(const unit of ["acre","sq_yd","sq_ft","gadi"])assert.ok(html.includes(`value="${unit}"`));
    assert.match(html,/name="description"/);
    if(!lockIdentity){
      const types=html.match(/<select[^>]*name="propertyType"[^>]*>(.*?)<\/select>/)?.[1]||"";
      assert.equal((types.match(/<option/g)||[]).length,1);
      assert.match(types,/Open Plot/);
    }
  }
});

test("other transactions keep their pricing and exclude Dev/JV from posting",()=>{
  for(const transactionType of ["rent","lease"]){
    const html=renderToStaticMarkup(createElement(PropertyPostingFields,{catalog:fallbackPropertyCatalog,defaults:{transactionType,category:"residential",propertyType:"villa"}}));
    assert.doesNotMatch(html,/dev-jv|Present Market Price/);
    assert.match(html,/Rent\/Lease amount/);
  }
  assert.equal(formatPropertyPrice({price:5000000,transactionType:"sale",categorySlug:"residential"}),"Price: ₹50,00,000");
  const types=typesFromCatalog(fallbackPropertyCatalog);
  assert.equal(types.filter(type=>type.value==="open-plot").length,1);
});

test("public Dev/JV price is a market valuation and purpose identifies the partnership",()=>{
  const property={price:5000000,transactionType:"sale" as const,categorySlug:"dev-jv"};
  assert.equal(formatPropertyPrice(property),"Present Market Price: ₹50,00,000");
  assert.equal(propertyPurposeLabel(property),"Development / Joint Venture");
});
