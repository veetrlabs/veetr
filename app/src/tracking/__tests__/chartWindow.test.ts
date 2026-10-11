import { chartEntries, zoomWindow } from '../chartWindow';
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
