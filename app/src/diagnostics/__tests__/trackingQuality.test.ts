import { qualitySample, qualitySnapshot, sanitizeQuality } from '../trackingQuality';
const fix = { timestamp: 1000, coords: { latitude: 49, longitude: 14, speed: 0.25, accuracy: 4, heading: 40 } };
test('quality samples preserve speeds and decisions without copying coordinates', () => {
  const sample = qualitySample(fix, { recordedAt: new Date(1000).toISOString(), latitude: 49, longitude: 14, accuracyM: 4, sogMps: 0, cogDeg: null, source: 'phone' }, 'quiet', 2000);
  expect(sample).toMatchObject({rawSpeedMps:0.25,speedMps:0,reason:'low_speed_noise',deliveryDelayMs:1000});
  expect(JSON.stringify(sample)).not.toMatch(/latitude|longitude|recordedAt/);
  const rows = sanitizeQuality([{ ...sample, ageSeconds: 1, latitude:49, privateID:'secret' }]);
  expect(JSON.stringify(rows)).not.toMatch(/latitude|privateID|secret/);
  expect(qualitySnapshot([sample], 2000+604801000)).toEqual([]);
});
test('rejected fixes retain only safe numeric evidence and unsupported measurements are null', () => {
  const sample = qualitySample({...fix,coords:{...fix.coords,speed:NaN,accuracy:150}},null,'unknown',2000);
  expect(sample).toMatchObject({reason:'rejected_fix',rawSpeedMps:null,accuracyM:150,speedAccuracyMps:null});
});
