import assert from "node:assert/strict";
import test from "node:test";
import { demoProperties } from "../src/data/demo-properties";
import { parsePropertyFilters } from "../src/lib/properties/filters";
import { sortProperties } from "../src/lib/properties/public";

test("parses safe URL filter state",()=>{const filters=parsePropertyFilters({purpose:"sale",category:"residential",minPrice:"2500000",amenities:["Parking","Lift"],sort:"price-desc",page:"2"});assert.equal(filters.purpose,"sale");assert.equal(filters.category,"residential");assert.equal(filters.minPrice,2500000);assert.deepEqual(filters.amenities,["Parking","Lift"]);assert.equal(filters.sort,"price-desc");assert.equal(filters.page,2)});
test("rejects invalid URL values and uses stable defaults",()=>{const filters=parsePropertyFilters({purpose:"delete",page:"-9",sort:"random"});assert.equal(filters.purpose,undefined);assert.equal(filters.minPrice,undefined);assert.equal(filters.maxArea,undefined);assert.equal(filters.bedrooms,undefined);assert.equal(filters.page,1);assert.equal(filters.sort,"newest");assert.equal(filters.pageSize,9)});
test("sorts by price and normalized area",()=>{const prices=sortProperties(demoProperties,"price-asc").map((property)=>property.price);assert.deepEqual(prices,[...prices].sort((a,b)=>a-b));const areas=sortProperties(demoProperties,"area-desc");assert.equal(areas[0].propertyTypeSlug,"agricultural-land")});
