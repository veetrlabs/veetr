import {
  setDeviceRecordingSource,
  preferredRecordingPoint,
  clearDeviceRecordingSource,
} from "../recordingSource";
import type { TrackingPoint } from "../model";
const now = Date.now();
const phone: TrackingPoint = {
  recordedAt: new Date(now).toISOString(),
  latitude: 49,
  longitude: 14,
  accuracyM: 5,
  sogMps: 1,
  cogDeg: 50,
  source: "phone",
};
beforeEach(clearDeviceRecordingSource);
test("one stream prefers fresh Veetr and falls back on disconnect and stale GPS", () => {
  const d = setDeviceRecordingSource(
    {
      gpsValid: true,
      lat: 50,
      lon: 15,
      gpsSpeed: 1.94384449,
      course: 20,
      windSpeed: 8,
      trueWindSpeed: 7,
    },
    now,
  );
  expect(preferredRecordingPoint(phone, now)).toEqual(d);
  expect(d?.sogMps).toBeCloseTo(1);
  expect(d?.instruments?.aws).toBe(8);
  expect(d?.accuracyM).toBeNull();
  expect(
    preferredRecordingPoint(
      { ...phone, recordedAt: new Date(now + 16000).toISOString() },
      now + 16000,
    )?.source,
  ).toBe("phone");
  clearDeviceRecordingSource();
  expect(preferredRecordingPoint(phone, now)).toBe(phone);
});
test("invalid device GPS and delayed phone samples are never replaced with unrelated fixes", () => {
  setDeviceRecordingSource(
    { gpsValid: true, lat: 50, lon: 15, gpsSpeed: 3 },
    now,
  );
  const old = { ...phone, recordedAt: new Date(now - 30000).toISOString() };
  expect(preferredRecordingPoint(old, now)).toBe(old);
  setDeviceRecordingSource({ gpsValid: false }, now);
  expect(preferredRecordingPoint(phone, now)).toBe(phone);
});
test('captures zero and signed wind angles, and never invents missing instruments',()=>{
 const point=setDeviceRecordingSource({gpsValid:true,lat:50,lon:15,gpsSpeed:0,windAngle:-45,trueWindAngle:0,heading:270},now);
 expect(point?.instruments).toMatchObject({awa:-45,twa:0,heading:270,aws:null,tws:null});
 const missing=setDeviceRecordingSource({gpsValid:true,lat:50,lon:15,windAngle:0,trueWindAngle:0,heading:0,recordingInstruments:{aws:null,tws:null,awa:null,twa:null,heading:null}},now);
 expect(missing?.instruments).toEqual({aws:null,tws:null,awa:null,twa:null,heading:null});
});
test('fresh instrument readings can accompany phone GPS when device GPS has no fix',()=>{
 setDeviceRecordingSource({gpsValid:false,recordingInstruments:{aws:8,tws:7,awa:-40,twa:-60,heading:120}},now);
 expect(preferredRecordingPoint(phone,now)).toMatchObject({source:'phone',instruments:{awa:-40,twa:-60}});
 expect(preferredRecordingPoint({...phone,recordedAt:new Date(now+16000).toISOString()},now+16000)?.instruments).toBeUndefined();
});
