import {boatTripPolars,allTripsPolar} from '../tripPolars';
import {tripObservations} from '../observations';
import type {Trip} from '../../tracking/trip';
jest.mock('../repository',()=>({polarRepository:{}}));
function trip(id:string,boatId='boat',engineUse?:Trip['session']['engineUse']):Trip {
 return {session:{id,boatId,boatName:'Boat',seriesId:'',seriesName:'',userId:'',phase:'stopping',engineUse,startedAt:'2026-10-13T00:00:00Z',expiresAt:'2026-10-14T00:00:00Z'},
 points:Array.from({length:100},(_,i)=>({recordedAt:new Date(Date.parse('2026-10-13T00:00:00Z')+i*5000).toISOString(),latitude:50,longitude:14,accuracyM:5,sogMps:2.5,cogDeg:20,source:'veetr' as const,instruments:{aws:8,tws:8,twa:60,heading:20}}))};
}
test('only finished trips for this boat appear; unknown engine use remains visible with warning',()=>{
 const rows=boatTripPolars([trip('unknown'),trip('sailing','boat','sailing-only'),trip('motor','boat','engine-used'),trip('other','other'),{...trip('active'),session:{...trip('active').session,phase:'recording'}}],'boat');
 expect(rows.map(row=>row.trip.session.id).sort()).toEqual(['motor','sailing','unknown']);
 expect(rows.find(row=>row.trip.session.id==='unknown')).toMatchObject({unknown:true,polar:{source:'learned'}});
 expect(rows.find(row=>row.trip.session.id==='motor')?.polar).toBeUndefined();
 expect(tripObservations(trip('motor','boat','engine-used').session,trip('motor').points)[0].engine).toBe(true);
});
test('aggregate uses eligible trips independently of display toggles and excludes motor data',()=>{
 const sailing=trip('sailing'),motor=trip('motor','boat','engine-used');
 expect(allTripsPolar([sailing,motor],'boat')?.points).toEqual(allTripsPolar([sailing],'boat')?.points);
 expect(allTripsPolar([motor],'boat')).toBeUndefined();
 expect(allTripsPolar([trip('other','other')],'boat')).toBeUndefined();
});
