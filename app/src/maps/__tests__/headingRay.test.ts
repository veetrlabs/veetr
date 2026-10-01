import { headingRay } from '../headingRay';
const origin = {latitude: 44, longitude: 15};
const region = {...origin, latitudeDelta: .1, longitudeDelta: .2};
test('heading extends beyond visible bounds in cardinal directions', () => {
  const end = (heading: number) => headingRay(origin, {instruments: {heading}}, region)[1];
  expect(end(0).latitude).toBeGreaterThan(44.05);
  expect(end(90).longitude).toBeGreaterThan(15.1);
  expect(end(180).latitude).toBeLessThan(43.95);
  expect(end(270).longitude).toBeLessThan(14.9);
  expect(end(0).longitude).toBeCloseTo(15);
});
test('scales to zoom and pan and falls back to course without inventing heading', () => {
  const reading = {cogDeg: 90};
  expect(headingRay(origin, {}, region)).toEqual([]);
  const near = headingRay(origin, reading, region)[1];
  const far = headingRay(origin, reading, {...region, longitudeDelta: 2})[1];
  expect(far.longitude).toBeGreaterThan(near.longitude);
  const panned = headingRay(origin, reading, {...region, longitude: 16})[1];
  expect(panned.longitude).toBeGreaterThan(16.1);
});
