import {receiveVaneDiagnostic,requestVaneDiagnostic,vaneFindings} from '../vane';
const sample={up:100,imu:true,q:10,a:10,age:0,quality:3,north:true,offset:10,raw:355,hdg:355,rej:0,gps:true,sat:12};
afterEach(()=>jest.useRealTimers());
test('matches two parts, ignores unrelated IDs and consumes diagnostics without treating them as navigation',async()=>{
 let id=0; const request=requestVaneDiagnostic(async c=>{id=c.id;return true},new AbortController().signal);
 expect(receiveVaneDiagnostic({HDM:40})).toBe(false);
 expect(receiveVaneDiagnostic({type:'vane_diag',id:id+1,part:0,...sample})).toBe(true);
 receiveVaneDiagnostic({type:'vane_diag',id,part:1,...sample});
 receiveVaneDiagnostic({type:'vane_diag',id,part:0,...sample,latitude:42});
 expect(await request).toEqual(sample);
});
test('missing part times out, malformed data is ignored, next request can run',async()=>{
 jest.useFakeTimers(); let id=0;
 const request=requestVaneDiagnostic(async c=>{id=c.id;return true},new AbortController().signal);
 const rejection=expect(request).rejects.toThrow('No diagnostic response');
 receiveVaneDiagnostic({type:'vane_diag',id,part:0,...sample,quality:'bad'});
 receiveVaneDiagnostic({type:'vane_diag',id,part:1,...sample});
 jest.advanceTimersByTime(5001); await rejection;
 const abort=new AbortController(); const next=requestVaneDiagnostic(async()=>true,abort.signal);
 const cancelled=expect(next).rejects.toThrow('cancelled'); abort.abort(); await cancelled;
});
test('no readings is distinguished from low quality and calibration is reported separately',()=>{
 expect(vaneFindings([{...sample,q:0,age:-1,quality:0,north:false}])).toContain('Compass quality is unavailable without recent readings.');
 expect(vaneFindings([sample,{...sample,q:20}])).toContain('A north alignment is loaded on Vane.');
});

test('heading changes handle north crossing and missing samples',()=>{
 const {largestHeadingStep}=require('../vane');
 expect(largestHeadingStep([{...sample,raw:359},{...sample,q:11,raw:1}])).toBe(2);
 expect(largestHeadingStep([{...sample,raw:null},{...sample,q:11}])).toBeNull();
});

test('extended samples wait for all four parts and retain only bounded sensor fields', async()=>{
 let id=0;const request=requestVaneDiagnostic(async c=>{id=c.id;expect(c.v).toBe(2);return true},new AbortController().signal);
 const sensor={mx:200,my:-100,mz:300,mq:1,ma:20,ce:5,ca:20,acc:100,gx:10,gy:20,gz:30,bx:1,by:2,bz:3,gq:2,ga:20};
 let done=false;void request.then(()=>{done=true});
 receiveVaneDiagnostic({type:'vane_diag',id,part:3,...sensor});
 receiveVaneDiagnostic({type:'vane_diag',id,part:1,...sample});
 receiveVaneDiagnostic({type:'vane_diag',id,part:0,n:4,...sample});
 receiveVaneDiagnostic({type:'vane_diag',id,part:2,...sensor,ce:8});
 await Promise.resolve();expect(done).toBe(false);
 receiveVaneDiagnostic({type:'vane_diag',id,part:2,...sensor,latitude:42});
 expect(await request).toEqual({...sample,sensor});
});
