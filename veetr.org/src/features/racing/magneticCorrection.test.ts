import test from "node:test";
import assert from "node:assert/strict";
import { magneticCorrection } from "./magneticCorrection";
import { trueBearing } from "./startSensors";

// NOAA WMM2025 sea-level reference values, including east and west corrections.
// https://www.ncei.noaa.gov/sites/default/files/2025-02/WMM2025testvalues.pdf
test("automatic declination matches NOAA WMM2025 reference values", () => {
  for (const [latitude, longitude, expected] of [[80, 0, 1.28], [0, 120, -0.16], [-80, -120, 68.78]]) {
    const actual = magneticCorrection({ latitude, longitude }, new Date("2025-01-01T00:00:00Z"));
    assert.ok(actual !== null && Math.abs(actual - expected) < 0.01, `${latitude},${longitude}: ${actual}`);
  }
  const later = magneticCorrection({latitude:80, longitude:0}, new Date("2027-07-02T12:00:00Z"));
  assert.ok(later !== null && Math.abs(later - 2.59) < 0.01);
});

test("correction refuses missing locations, invalid values and expired models", () => {
  const date = new Date("2026-10-10T00:00:00Z");
  assert.equal(magneticCorrection(undefined, date), null);
  for (const point of [{latitude:NaN,longitude:0},{latitude:91,longitude:0},{latitude:0,longitude:181}]) assert.equal(magneticCorrection(point,date),null);
  assert.equal(magneticCorrection({latitude:50,longitude:14}, new Date("2040-01-01")),null);
  assert.equal(magneticCorrection({latitude:50,longitude:14}, new Date(NaN)),null);
});

test("location changes update the correction and true bearings wrap north", () => {
  const date = new Date("2026-10-10T00:00:00Z");
  const east = magneticCorrection({latitude:49.58,longitude:14.18},date)!;
  const west = magneticCorrection({latitude:40.7,longitude:-74},date)!;
  assert.ok(east > 0 && west < 0);
  assert.ok(Math.abs(trueBearing(359,east) - (east-1)) < 1e-8);
  assert.ok(trueBearing(1,west) > 340);
});
