import { chartEntries, zoomWindow } from '../chartWindow';
import { chartPath } from '../trip';
import type { TrackingPoint } from '../model';
const points = [0, 5, 0, 5, 0].map((longitude, i) => ({
  latitude: 0, longitude, recordedAt: new Date(i * 5000).toISOString(), sogMps: 2,
} as TrackingPoint));
const region = { latitude: 0, longitude: 0, latitudeDelta: 1, longitudeDelta: 1 };
test('map filtering retains original indices and separates repeat visits even with short time gaps', () => {
  const entries = chartEntries(points, region);
  expect(entries.map(e => e.index)).toEqual([0, 2, 4]);
  const path = chartPath(entries.map(e => e.point), 'sog', 5, 320, 140, 0, entries.map(e => e.index));
  expect(path.match(/M/g)).toHaveLength(3);
  expect(path).not.toContain('L');
});
test('viewport filtering handles the date line, empty views and time windows', () => {
  expect(chartEntries(points, { ...region, latitude: 10 })).toEqual([]);
  expect(chartEntries(points, region, [5000, 15000]).map(e => e.index)).toEqual([2]);
  expect(chartEntries([{ ...points[0], longitude: -179.9 }], { ...region, longitude: 179.9 })).toHaveLength(1);
});
test('pinch zoom preserves anchor and clamps to trip bounds including a single sample', () => {
  expect(zoomWindow([0, 10000], [0, 10000], 2)).toEqual([2500, 7500]);
  expect(zoomWindow([0, 10000], [0, 10000], 2, 0)).toEqual([0, 5000]);
  expect(zoomWindow([0, 10000], [2500, 7500], 0.1)).toEqual([0, 10000]);
  expect(zoomWindow([5, 5], [5, 5], 2)).toEqual([5, 5]);
});
