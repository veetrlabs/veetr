import { normalizeFix, type LocationFix } from "../model";
const now = Date.now(),
  fix: LocationFix = {
    timestamp: now,
    coords: { latitude: 0, longitude: 0, accuracy: 5, speed: 3, heading: 90 },
  };
test("valid zero coordinates and GPS speed are preserved", () => {
  expect(normalizeFix(fix, now)).toMatchObject({
    latitude: 0,
    longitude: 0,
    sogMps: 3,
    cogDeg: 90,
    source: "phone",
  });
});
test("unavailable GPS speed is not presented as a stopped boat or compass heading", () => {
  expect(
    normalizeFix({ ...fix, coords: { ...fix.coords, speed: -1 } }, now),
  ).toMatchObject({ sogMps: null, cogDeg: null });
  expect(
    normalizeFix({ ...fix, coords: { ...fix.coords, speed: 0 } }, now)?.cogDeg,
  ).toBeNull();
});
test.each([
  { accuracy: 101 },
  { accuracy: null },
  { latitude: NaN },
  { latitude: 91 },
  { longitude: -181 },
])("unusable GPS fix rejected: %p", (override) => {
  expect(
    normalizeFix({ ...fix, coords: { ...fix.coords, ...override } }, now),
  ).toBeNull();
});
test("invalid and future timestamps rejected", () => {
  expect(normalizeFix({ ...fix, timestamp: NaN }, now)).toBeNull();
  expect(normalizeFix({ ...fix, timestamp: now + 31000 }, now)).toBeNull();
});

test.each([100, 100.01, 231.120357, 1200])('preserves valid speed %s and its course', speed => {
  expect(normalizeFix({ ...fix, coords: { ...fix.coords, speed } }, now))
    .toMatchObject({ sogMps: speed, cogDeg: 90 });
});
test.each([null, -1, NaN, Infinity, -Infinity])('keeps invalid speed %s unknown', speed => {
  expect(normalizeFix({ ...fix, coords: { ...fix.coords, speed } }, now))
    .toMatchObject({ sogMps: null, cogDeg: null });
});
