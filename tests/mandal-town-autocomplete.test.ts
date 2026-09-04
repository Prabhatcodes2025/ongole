import assert from "node:assert/strict";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {MandalTownAutocomplete,mandalTowns,matchingMandalTowns} from "../src/components/mandal-town-autocomplete";
import {parsePropertyFilters} from "../src/lib/properties/filters";

test("only the supplied towns are suggested after three characters",()=>{
  for(const query of ["","K","Ka","  Ka  "])assert.deepEqual(matchingMandalTowns(query),[]);
  assert.equal(mandalTowns.length,59);
  assert.equal(new Set(mandalTowns).size,59);
  assert.deepEqual(matchingMandalTowns("Kan"),["Kandukur","Kanigiri","Karamchedu","Konakanamitla"]);
  assert.deepEqual(matchingMandalTowns("kAN"),matchingMandalTowns("Kan"));
  assert.deepEqual(matchingMandalTowns("Ongole"),["Ongole Urban","Ongole Rural"]);
  assert.deepEqual(matchingMandalTowns("Bhagya Nagar"),[]);
});

test("saved and cleared selection retain the existing city query contract",()=>{
  for(const city of ["Kandukur",""]){
    const html=renderToStaticMarkup(createElement(MandalTownAutocomplete,{defaultValue:city}));
    assert.ok(html.includes(`name="city" value="${city}"`));
    assert.match(html,/placeholder="Type to search Mandal\/Town"/);
    assert.match(html,/aria-expanded="false"/);
    assert.doesNotMatch(html,/role="option"/);
    for(const purpose of ["sale","rent"]){
      const filters=parsePropertyFilters({city,purpose,locality:"Bhagya Nagar"});
      assert.equal(filters.city,city||undefined);
      assert.equal(filters.purpose,purpose);
      assert.equal(filters.locality,"Bhagya Nagar");
    }
  }
});
