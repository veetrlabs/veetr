import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sharedDistance,
  tripMetric,
  tripPlot,
  type TripSample,
} from "./sharedTripData";
const point = (sec: number): TripSample => ({
  recordedAt: new Date(100000 + sec * 1000).toISOString(),
  latitude: 0,
  longitude: sec / 300,
  sogMps: 0,
  instruments: { awa: 0, twa: -90 },
});
test("shared trip plots preserve zero, signed angles, nulls and gaps", () => {
  assert.equal(tripMetric(point(0), "sog"), 0);
  assert.equal(tripMetric(point(0), "twa"), -90);
  assert.equal(tripMetric(point(0), "aws"), null);
  const plot = tripPlot([point(0), point(5), point(90)], "twa");
  assert.equal(plot.min, -180);
  assert.equal(plot.max, 180);
  assert.equal(plot.d.split("M").length, 3);
  assert.equal(tripPlot([point(0)], "aws").d, "");
  assert.ok(
    Math.abs(sharedDistance([point(0), point(5), point(90)]) - 1) < 0.01,
  );
});

test("map orientation preserves signed wind angles, north and absent heading", async () => {
  const { boatOrientation } = await import("./sharedTripData");
  assert.deepEqual(boatOrientation({ instruments: { heading: 0, twa: 0 } }), {
    heading: 0,
    courseOnly: false,
    windFrom: 0,
  });
  assert.equal(
    boatOrientation({ instruments: { heading: 10, twa: -45 } }).windFrom,
    325,
  );
  assert.equal(
    boatOrientation({ instruments: { heading: 350, twa: 45 } }).windFrom,
    35,
  );
  assert.deepEqual(boatOrientation({ cogDeg: 90, instruments: { twa: 30 } }), {
    heading: 90,
    courseOnly: true,
    windFrom: null,
  });
  assert.equal(boatOrientation({}).heading, null);
  assert.equal(tripPlot([point(0)], "sog", 20).max, 20);
});
