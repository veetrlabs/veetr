import { fleetChartSeries } from "../chartSeries";
import type { TrackingPoint } from "../model";
const point = (second: number, speed: number | null, wind?: number): TrackingPoint => ({
  recordedAt: new Date(second * 1000).toISOString(), latitude: 43, longitude: 15,
  sogMps: speed, source: "phone", accuracyM: 5, cogDeg: 0,
  ...(wind === undefined ? {} : { instruments: { aws: wind, tws: null } }),
});
test("boats share axes but keep separate paths, metrics and recording gaps", () => {
  const chart = fleetChartSeries([
    { id: "a", name: "Alpha", color: "red", points: [point(0, 1, 5), point(10, 2, 6), point(100, 3)] },
    { id: "b", name: "Beta", color: "blue", points: [point(10, 4), point(20, 5)] },
  ], [0, 100000], 15000);
  expect(chart.series.map(s => s.id)).toEqual(["a:sog", "a:aws", "b:sog"]);
  expect(chart.series[0].path.match(/M/g)).toHaveLength(2);
  expect(chart.series[2].path).toMatch(/^M32.00,/);
  expect(chart.series[2].path).toContain("L64.00,");
  expect(chart.series[2].color).toBe("blue");
  expect(chart.series[2].value).toBeCloseTo(4 * 1.94384449);
  expect(chart.series[1].value).toBe(6);
  expect(chart.max).toBeCloseTo(5 * 1.94384449 * 1.08);
});
test("future and stale values are absent and hidden boats do not affect scale", () => {
  const boat = { id: "b", name: "Beta", color: "blue", points: [point(20, 1), point(120, 50)] };
  expect(fleetChartSeries([boat], [0, 120000], 10000).series[0].value).toBeNull();
  expect(fleetChartSeries([boat], [0, 120000], 90000).series[0].value).toBeNull();
  expect(fleetChartSeries([], [0, 120000], 20000)).toEqual({ max: 1, series: [] });
  const zoomed = fleetChartSeries([boat], [0, 30000], 20000);
  expect(zoomed.max).toBeCloseTo(1.94384449 * 1.08);
  expect(zoomed.series[0].path).not.toContain("L");
});
