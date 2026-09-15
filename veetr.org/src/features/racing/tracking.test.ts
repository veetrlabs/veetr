import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTrackingPositions, positionAge } from "./tracking";
const now = Date.now(),
  point = {
    boatId: "boat",
    boatName: "<script>Boat</script>",
    recordedAt: new Date(now - 65000).toISOString(),
    latitude: 0,
    longitude: 0,
    accuracyM: 5,
    sogMps: null,
    cogDeg: null,
    source: "phone",
    trail: [[0, 0]],
  };
test("map uses observation time, preserves unknown speed, and recognizes stale fixes", () => {
  const [p] = parseTrackingPositions([point]);
  assert.equal(p.sogMps, null);
  assert.equal(positionAge(p, now), 65);
  assert.equal(
    positionAge({ ...p, recordedAt: new Date(now + 1000).toISOString() }, now),
    0,
  );
});
test("malformed feeds fail closed", () => {
  for (const value of [
    {},
    null,
    [{ ...point, latitude: 100 }],
    [{ ...point, trail: [[NaN, 4]] }],
    [{ ...point, recordedAt: "bad" }],
    [{ ...point, sogMps: -1 }],
  ])
    assert.throws(() => parseTrackingPositions(value), /Invalid tracking/);
  assert.deepEqual(parseTrackingPositions([]), []);
});
