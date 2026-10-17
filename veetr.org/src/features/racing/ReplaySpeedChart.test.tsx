import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReplaySpeedChart, replayTimeAt, speedSeries } from './ReplaySpeedChart';
import type { TrackPoint } from './trackCache';
const point = (at: number, sogMps: number | null, sessionId = 'session', boatId = 'boat'): TrackPoint => ({ boatId, boatName: boatId, sessionId, recordedAt: new Date(at).toISOString(), sogMps, latitude: 43, longitude: 16, accuracyM: 5, cogDeg: 0, source: 'phone' });
test('speed chart converts to knots and splits missing readings, recording gaps and sessions', () => {
  const series = speedSeries([point(140000, 4, 'next'), point(0, 1), point(1000, 2), point(2000, null), point(3000, 3), point(130000, 4)]);
  assert.equal(series[0].segments.length, 4);
  assert.equal(series[0].segments[0][0].knots, 1.94384449);
  assert.equal(series[0].segments[0].length, 2);
});
test('pointer selection maps chart width to race time and clamps outside edges', () => {
  assert.equal(replayTimeAt(150, 100, 100, 1000, 5000), 3000);
  assert.equal(replayTimeAt(50, 100, 100, 1000, 5000), 1000);
  assert.equal(replayTimeAt(250, 100, 100, 1000, 5000), 5000);
});
test('hidden boats keep their single toggle but have no plotted speed line', () => {
  const html = renderToStaticMarkup(<ReplaySpeedChart points={[point(0, 1), point(1000, 2)]} bounds={{start: 0, end: 1000}} at={500} colors={{boat: '#ff0000'}} hidden={new Set(['boat'])} toggle={() => {}} seek={() => {}} loading={false} />);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /role="slider"/);
  assert.match(html, /aria-valuenow="500"/);
  assert.doesNotMatch(html, /<polyline/);
  assert.doesNotMatch(html, /type="range"/);
});
