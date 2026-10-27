import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDateTime,utcDateTime,validTimezone,setTimezonePreference,formatDateTime} from './timezone';
import {raceEventDetails} from './SeriesBrowser';
test('wall-clock input converts to UTC with winter, summer and fractional offsets',()=>{
 assert.equal(utcDateTime('2026-01-15T10:00','Europe/Prague'),'2026-01-15T09:00:00.000Z');
 assert.equal(utcDateTime('2026-07-15T10:00','Europe/Prague'),'2026-07-15T08:00:00.000Z');
 assert.equal(utcDateTime('2026-01-15T10:00','Asia/Kathmandu'),'2026-01-15T04:15:00.000Z');
 assert.equal(localDateTime('2026-01-15T01:00:00Z','America/New_York'),'2026-01-14T20:00:00');
});
test('daylight-saving gaps, repeated times and invalid dates are not silently shifted',()=>{
 assert.throws(()=>utcDateTime('2026-03-29T02:30','Europe/Prague'),/does not exist/);
 assert.throws(()=>utcDateTime('2026-10-25T02:30','Europe/Prague'),/occurs twice/);
 assert.throws(()=>utcDateTime('2026-02-30T10:00','UTC'),/valid/);
 assert.equal(utcDateTime('2026-10-25T02:30','UTC'),'2026-10-25T02:30:00.000Z');
 assert.equal(validTimezone('invalid'),false);
});
test('race editing retains its input timezone if the viewer changes preferences',()=>{
 const data=new FormData();data.set('name','Race');data.set('scheduledStart','2026-07-15T10:00');
 setTimezonePreference('America/New_York');
 assert.equal(raceEventDetails(data,[],'Europe/Prague').scheduledStart,'2026-07-15T08:00:00.000Z');
 assert.match(formatDateTime('2026-07-15T08:00:00Z','time','en-GB',{hour:'2-digit',minute:'2-digit'}),/04:00/);
 setTimezonePreference('auto');
});

test('an unchanged start in a repeated hour preserves its original instant',()=>{
 const data=new FormData();data.set('name','Race');data.set('scheduledStart','2026-10-25T02:30');
 assert.equal(raceEventDetails(data,[],'Europe/Prague','2026-10-25T01:30:00Z').scheduledStart,'2026-10-25T01:30:00Z');
});
