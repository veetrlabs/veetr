import { chartEntries, chartTimeBounds, zoomWindow } from '../chartWindow';
import type { TrackingPoint } from '../model';
const points = [0, 5, 0, 5, 0].map((longitude, i) => ({
  latitude: 0, longitude, recordedAt: new Date(i * 5000).toISOString(), sogMps: 2,
} as TrackingPoint));
test('time filtering preserves original indices and includes the whole trip by default', () => {
  expect(chartEntries(points).map(e => e.index)).toEqual([0, 1, 2, 3, 4]);
  expect(chartEntries(points, [5000, 15000]).map(e => e.index)).toEqual([1, 2, 3]);
  expect(chartEntries(points, [30000, 40000])).toEqual([]);
});
test('pinch zoom preserves anchor and clamps to trip bounds including a single sample', () => {
  expect(zoomWindow([0, 10000], [0, 10000], 2)).toEqual([2500, 7500]);
  expect(zoomWindow([0, 10000], [0, 10000], 2, 0)).toEqual([0, 5000]);
  expect(zoomWindow([0, 10000], [2500, 7500], 0.1)).toEqual([0, 10000]);
  expect(zoomWindow([5, 5], [5, 5], 2)).toEqual([5, 5]);
});

test('includes the visible portion of a recording gap without inventing samples', () => {
  const data = [
    { ...points[0], longitude: 10, recordedAt: new Date(0).toISOString(), sogMps: null },
    { ...points[0], longitude: 0, recordedAt: new Date(1000000).toISOString() },
    { ...points[0], longitude: 0, recordedAt: new Date(1100000).toISOString() },
  ];
  const region = { latitude: 0, longitude: 0, latitudeDelta: 2, longitudeDelta: 4 };
  expect(chartTimeBounds(data, region)).toEqual([800000, 1100000]);
  expect(chartEntries(data, undefined, region).map(e => e.index)).toEqual([1, 2]);
  expect(chartTimeBounds(data, { ...region, longitude: 5 })).toEqual([300000, 700000]);
  expect(chartEntries(data, undefined, { ...region, longitude: 5 })).toEqual([]);
  expect(chartTimeBounds(data)).toEqual([0, 1100000]);
  expect(chartTimeBounds(data, { ...region, latitude: 20 }).every(Number.isNaN)).toBe(true);
});

test('clips an estimated bridge across the date line', () => {
  const data = [179, -179].map((longitude, i) => ({ ...points[0], longitude, recordedAt: new Date(i * 100000).toISOString() }));
  const bounds = chartTimeBounds(data, { latitude: 0, longitude: 180, latitudeDelta: 2, longitudeDelta: 1 });
  expect(bounds).toEqual([25000, 75000]);
});
