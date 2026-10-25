jest.mock('../tripRecording',()=>({DIAGNOSTIC_SCHEMA:1,flushTripDiagnostics:async()=>{},tripDiagnosticBridge:()=>null}));
import {writeTripExport} from '../tripExport';
const trip={session:{id:'trip'},points:[{recordedAt:'time',sogMps:0}],archived:true} as any;
test('streams ordered native pages up to a fixed snapshot, with raw trip intact',async()=>{
 const bridge={snapshot:jest.fn(async()=>({through:3,bytes:100,dropped:2,limitBytes:200})),
 read:jest.fn(async(_id,after)=>after===0?[{seq:1,body:'{"type":"metadata"}'}]:[{seq:3,body:'{"type":"sensor","values":[1,2,3]}'}])} as any;
 const chunks:string[]=[];await writeTripExport(trip,s=>chunks.push(s),bridge);
 const result=JSON.parse(chunks.join(''));
 expect(result.points).toEqual(trip.points);expect(result.diagnostics.dropped).toBe(2);
 expect(result.diagnostics.entries).toHaveLength(2);expect(bridge.read).toHaveBeenLastCalledWith('trip',1,3);
});
test('unavailable recorder does not fabricate a diagnostic history',async()=>{
 let data='';await writeTripExport(trip,s=>data+=s,null);
 expect(JSON.parse(data).diagnostics).toMatchObject({available:false,reason:'native_recorder_unavailable'});
});
test('consent deletion during export fails rather than exporting an apparently complete log',async()=>{
 const bridge={snapshot:async()=>({through:2}),read:async()=>[]} as any;
 await expect(writeTripExport(trip,()=>{},bridge)).rejects.toThrow('changed during export');
});
