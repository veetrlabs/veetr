import type { TrackingSession, LocationFix } from '../../tracking/model';
const mockBridge = { configure:jest.fn(async(_enabled:boolean,_session:string|null,_expires:number,_metadata:string)=>{}), append:jest.fn(async()=>{}), delete:jest.fn(async()=>{}) };
jest.mock('expo-modules-core',()=>({requireOptionalNativeModule:()=>mockBridge}));
jest.mock('react-native',()=>({AppState:{currentState:'active'},Platform:{OS:'ios',Version:26}}));
jest.mock('expo-constants',()=>({expoConfig:{version:'test'}}));
jest.mock('expo-application',()=>({nativeApplicationVersion:'1',nativeBuildVersion:'61'}));
jest.mock('expo-device',()=>({modelName:'test-phone',osVersion:'26'}));
import {configureTripDiagnostics,recordTripDiagnostic,flushTripDiagnostics,diagnosticFix} from '../tripRecording';
const session={id:'trip',phase:'recording',expiresAt:new Date(Date.now()+3600000).toISOString()} as TrackingSession;
beforeEach(async()=>{await configureTripDiagnostics(false,null);jest.clearAllMocks();});
test('off is lazy; only active opted-in trips collect and revocation cancels queued producers',async()=>{
 const build=jest.fn(()=>({type:'test'}));
 recordTripDiagnostic('trip',build);await flushTripDiagnostics();expect(build).not.toHaveBeenCalled();
 await configureTripDiagnostics(true,session);
 recordTripDiagnostic('another-trip',build);await flushTripDiagnostics();expect(build).not.toHaveBeenCalled();
 recordTripDiagnostic('trip',build);await flushTripDiagnostics();expect(mockBridge.append).toHaveBeenCalledWith('trip','[{"type":"test"}]');
 build.mockClear();recordTripDiagnostic('trip',build);await configureTripDiagnostics(false,null);await flushTripDiagnostics();
 expect(build).not.toHaveBeenCalled();expect(mockBridge.configure).toHaveBeenLastCalledWith(false,null,0,expect.any(String));
});
test('metadata includes schema, filter and build versions without device owner name',async()=>{
 await configureTripDiagnostics(true,session);
 const metadata=JSON.parse(mockBridge.configure.mock.calls[0][3]);
 expect(metadata).toMatchObject({schemaVersion:1,filterVersion:'phone-speed-v1',build:'61',sensorRateHz:5});
 expect(metadata.deviceName).toBeUndefined();
});
test('raw values and uncertainties survive filtering; missing values remain explicit',()=>{
 const raw={timestamp:1000,coords:{latitude:1,longitude:2,accuracy:40,speed:2,heading:90,speedAccuracy:.5}} as LocationFix;
 const result=diagnosticFix(raw,{sogMps:null} as any,null,'unknown','task',1600);
 expect(result.raw.coords).toMatchObject({speed:2,speedAccuracy:.5,headingAccuracy:null});
 expect(result).toMatchObject({deliveryDelayMs:600,reason:'poor_accuracy',estimated:false,confidence:null,recorded:null});
 expect(raw.coords.speed).toBe(2);
});
