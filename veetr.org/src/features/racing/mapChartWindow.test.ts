import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapChartWindow } from './mapChartWindow';
const point = (time: number, longitude: number, latitude = 0) => ({ recordedAt: new Date(time).toISOString(), latitude, longitude });
const viewport = {south: -1, north: 1, west: 10, east: 20};
test('zooming to route positions narrows time and zooming out restores the recording', () => {
  const points = [point(0, 0), point(1000, 10), point(2000, 15), point(3000, 30)];
  assert.deepEqual(mapChartWindow(points, viewport), {start: 1000, end: 2000});
  assert.deepEqual(mapChartWindow(points, {...viewport, west: -180, east: 180}), {start: 0, end: 3000});
  assert.equal(mapChartWindow(points, {...viewport, south: 20, north: 30}), null);
  assert.deepEqual(mapChartWindow([points[1]], viewport), {start: 1000, end: 1000});
  assert.equal(mapChartWindow([], null), null);
});
test('repeated visits use the full visible time span regardless of sample ordering', () => {
  assert.deepEqual(mapChartWindow([point(3000, 15), point(0, 15), point(2000, 50)], viewport), {start: 0, end: 3000});
});
test('wrapped world copies and date-line crossings select the same route', () => {
  const points = [point(0, 179), point(1000, -179), point(2000, 0)];
  for (const [west, east] of [[170,190],[170,-170],[-190,-170],[530,550]]) {
    assert.deepEqual(mapChartWindow(points, {...viewport, west, east}), {start: 0, end: 1000});
  }
});

test('visible segments preserve single fixes, separate passes and wrapped coordinates', async () => {
  const { visibleMapSegments } = await import('./mapChartWindow');
  const points = [point(0,15),point(1000,50),point(2000,15),point(3000,16)];
  assert.deepEqual(visibleMapSegments(points, viewport), [[points[0]], [points[2],points[3]]]);
  assert.deepEqual(visibleMapSegments(points, null), [points]);
  assert.deepEqual(visibleMapSegments(points, {...viewport,south:10,north:20}), []);
  const wrapped = [point(0,179),point(1000,0),point(2000,-179)];
  assert.deepEqual(visibleMapSegments(wrapped, {...viewport,west:170,east:-170}), [[wrapped[0]],[wrapped[2]]]);
});
