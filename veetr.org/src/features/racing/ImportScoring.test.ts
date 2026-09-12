import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateRacePoints} from '@veetr/scoring';
import {eventStandings,seriesRounds,validateSeries,type Series} from './domain';
const s:Series=JSON.parse(readFileSync(new URL('../../../imports/orlik-2026/series.json',import.meta.url),'utf8'));
test('real import preserves source points and excludes running and cancelled rounds',()=>{
 validateSeries(s);
 const iz=s.events!.find(e=>e.name==='Izolepa')!;
 assert.equal(s.races.filter(r=>r.eventId===iz.id).length,2);
 const family=s.boats.find(b=>b.name.toLowerCase()==='family lady')!;
 const row=eventStandings(s,iz,family.categoryId).find(r=>r.id===family.id)!;
 assert.equal(row.rawTotal,3);
 assert.equal(seriesRounds(s).filter(r=>r.name.startsWith('24hodinovka')).length,2);
 assert.equal(seriesRounds(s).filter(r=>r.name==='Vánoční regata')[0].results.length,0);
 assert.ok(s.races.every(r=>r.date===''));
});
test('source penalties and zero points are accepted without inventing finish positions',()=>{
 assert.equal(calculateRacePoints({boatId:'a',status:'DNS',points:12},13),12);
 assert.equal(calculateRacePoints({boatId:'a',status:'SCORED',points:0},13),0);
 assert.throws(()=>calculateRacePoints({boatId:'a',status:'SCORED',points:-1},13));
 assert.throws(()=>calculateRacePoints({boatId:'a',status:'SCORED'},13));
});
