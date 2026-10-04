import {test} from "node:test";
import assert from "node:assert/strict";
import countries from "./countries.json";
import {startCountry} from "./tripCountry";
test("start country uses land boundaries and does not guess offshore", () => {
 assert.equal(startCountry(countries,49.54,14.17),"Czech Republic");
 assert.equal(startCountry(countries,45.8,16),"Croatia");
 assert.equal(startCountry(countries,0,-30),"At sea / unknown");
 assert.equal(startCountry(countries,null,null),"Unknown");
});
test("polygon holes are not treated as land", () => {
 const data=[{name:"Example",polygons:[[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]]}];
 assert.equal(startCountry(data,5,5),"At sea / unknown");
 assert.equal(startCountry(data,2,2),"Example");
});
