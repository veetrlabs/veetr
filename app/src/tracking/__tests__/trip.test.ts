import {
  chartPath,
  distanceNm,
  durationLabel,
  metricValue,
  nearestPoint,
  orderedPoints,
  routeSegments,
  tripDuration,
  type Trip,
} from "../trip";
import type { TrackingPoint } from "../model";
const at = Date.parse("2026-09-16T08:00:00Z");
const point = (
  seconds: number,
  overrides: Partial<TrackingPoint> = {},
): TrackingPoint => ({
  recordedAt: new Date(at + seconds * 1000).toISOString(),
  latitude: 0,
  longitude: 0,
  accuracyM: 5,
  sogMps: 2,
  cogDeg: 90,
  source: "phone",
  ...overrides,
});
test("distance uses GPS positions in nautical miles, including zero coordinates", () => {
  expect(distanceNm([point(0), point(5, { longitude: 1 / 60 })])).toBeCloseTo(
    1,
    2,
  );
});
test("recording gaps and invalid coordinates do not create fictional connecting legs", () => {
  const points = [
    point(0),
    point(5, { longitude: 1 / 60 }),
    point(120, { longitude: 2 }),
    point(125, { latitude: NaN }),
    point(130, { longitude: 3 }),
  ];
  expect(routeSegments(points).map((s) => s.length)).toEqual([2, 1, 1]);
  expect(distanceNm(points)).toBeCloseTo(1, 2);
});
test("scrubbing follows time rather than sample index, clamps ends, and handles empty trips", () => {
  const points = [point(0), point(5), point(50)];
  expect(nearestPoint(points, at + 20000)).toBe(1);
  expect(nearestPoint(points, at + 45000)).toBe(2);
  expect(nearestPoint(points, at - 1000)).toBe(0);
  expect(nearestPoint(points, at + 100000)).toBe(2);
  expect(nearestPoint([], at)).toBe(-1);
});
test("chart preserves unavailable values, real zero speed, wind-only records, and gaps", () => {
  expect(metricValue(point(0, { sogMps: null }), "sog")).toBeNull();
  expect(metricValue(point(0, { sogMps: 0 }), "sog")).toBe(0);
  expect(
    metricValue(point(0, { instruments: { aws: 12, tws: null } }), "aws"),
  ).toBe(12);
  expect(metricValue(point(0), "tws")).toBeNull();
  const path = chartPath(
    [point(0), point(5, { sogMps: null }), point(10), point(120)],
    "sog",
    10,
  );
  expect(path.match(/M/g)).toHaveLength(3);
  expect(chartPath([], "sog", 1)).toBe("");
});
test("stopped trip duration is frozen and point ordering never mutates the recording", () => {
  const points = [point(10), point(0)];
  expect(orderedPoints(points)[0]).toEqual(point(0));
  expect(points[0]).toEqual(point(10));
  const trip = {
    session: {
      startedAt: point(0).recordedAt,
      stoppedAt: point(90).recordedAt,
      phase: "stopping",
    },
    points,
  } as Trip;
  expect(tripDuration(trip, at + 999999)).toBe(90000);
  expect(durationLabel(3661000)).toBe("1h 01m");
});
