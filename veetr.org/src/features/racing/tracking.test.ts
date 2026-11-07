import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTrackingPositions, positionAge, positionsForHeat } from "./tracking";
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

test("heat maps include only entered boats, including an empty heat", () => {
  const positions = parseTrackingPositions([point, {...point, boatId: 'other-heat'}]);
  assert.deepEqual(positionsForHeat(positions, ['boat']), [positions[0]]);
  assert.deepEqual(positionsForHeat(positions, []), []);
  assert.deepEqual(positionsForHeat(positions, ['missing']), []);
});

test('accepts finite high speeds while rejecting malformed speeds', () => {
  for (const sogMps of [0, 100, 231.120357, 1200])
    assert.equal(parseTrackingPositions([{ ...point, sogMps }])[0].sogMps, sogMps);
  for (const sogMps of [-1, NaN, Infinity, -Infinity, '231'])
    assert.throws(() => parseTrackingPositions([{ ...point, sogMps }]), /Invalid tracking/);
});
