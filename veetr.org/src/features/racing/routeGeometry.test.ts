import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeGeometry} from './routeGeometry';
const fix=(second:number,x:number,y=0,accuracyM=5,sessionId='a')=>({recordedAt:new Date(100000+second*1000).toISOString(),latitude:y/111195,longitude:x/111195,accuracyM,sessionId});
test('isolated implausible departure and return becomes an estimated bridge without mutation',()=>{
 const points=[fix(0,0),fix(1,2),fix(2,4,100),fix(3,6),fix(4,8)];
 const sections=routeGeometry(points);
 assert.deepEqual(sections.map(s=>s.estimated),[false,true,false]);
 assert.deepEqual(sections[1].points,[points[1],points[3]]);
 assert.equal(points[2].latitude,100/111195);
});
test('retains real sharp turns and sustained high speed',()=>{
 for(const points of [[fix(0,0),fix(1,3),fix(2,3,3),fix(3,0,3),fix(4,0)],Array.from({length:8},(_,i)=>fix(i,i*30))]){
  assert.deepEqual(routeGeometry(points),[{points,estimated:false}]);
 }
});
test('poor fixes and long gaps stay connected as estimates, never across sessions',()=>{
 const points=[fix(0,0),fix(1,2,50,70),fix(2,4),fix(90,6)];
 assert.deepEqual(routeGeometry(points),[{points:[points[0],points[2],points[3]],estimated:true}]);
 const sessions=routeGeometry([fix(0,0),fix(1,2),fix(2,4,0,5,'b'),fix(3,6,0,5,'b')]);
 assert.equal(sessions.length,2); assert.ok(sessions.every(s=>!s.estimated));
});
test('uncertain endpoints remain marked and single fixes remain visible',()=>{
 const points=[fix(0,0,0,70),fix(1,2),fix(2,4,0,70)];
 assert.deepEqual(routeGeometry(points),[{points,estimated:true}]);
 assert.deepEqual(routeGeometry([fix(0,0)]),[{points:[fix(0,0)],estimated:false}]);
});
