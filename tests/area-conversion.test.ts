import assert from "node:assert/strict";
import test from "node:test";
import { areaEquivalents, convertArea, formatArea } from "../src/lib/area-conversion";

test("converts every supported area unit through square feet",()=>{assert.equal(convertArea(1,"acre","sq_ft"),43560);assert.equal(convertArea(1,"cent","sq_ft"),435.6);assert.equal(convertArea(1,"gadi","sq_ft"),72);assert.equal(convertArea(720,"sq_ft","gadi"),10);assert.equal(convertArea(100,"sq_m","sq_ft"),1076.391);assert.equal(convertArea(240,"sq_yd","sq_ft"),2160)});
test("formats stable area values and rejects invalid input",()=>{assert.equal(formatArea(1680,"sq_ft"),"1,680 sq.ft");assert.equal(areaEquivalents(1,"acre").find((item)=>item.unit==="cent")?.value,100);assert.throws(()=>convertArea(Number.NaN,"sq_ft","acre"))});
test("uses the Ongole Gadi convention for exact and rounded values",()=>{assert.equal(convertArea(72,"sq_ft","gadi"),1);assert.equal(convertArea(720,"sq_ft","gadi"),10);assert.equal(convertArea(1000,"sq_ft","gadi"),13.8889);assert.throws(()=>convertArea(-1,"sq_ft","gadi"))});
