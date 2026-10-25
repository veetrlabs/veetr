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

test('map window rescales the plot and timeline without losing boat toggles', () => {
  const props = {points:[point(0,100),point(1000,1),point(2000,2),point(3000,100,'session','other')],bounds:{start:0,end:3000},at:3000,colors:{},hidden:new Set<string>(),toggle:()=>{},seek:()=>{},loading:false};
  const html=renderToStaticMarkup(<ReplaySpeedChart {...props} window={{start:1000,end:2000}}/>);
  assert.match(html,/aria-valuemin="1000" aria-valuemax="2000"/);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,2);
  assert.match(html,/points="0.00,[^ ]+ 1000.00,/);
  assert.doesNotMatch(html,/class="replay-chart-cursor"/);
  const empty=renderToStaticMarkup(<ReplaySpeedChart {...props} window={null}/>);
  assert.match(empty,/No recorded positions in this map area/);
  assert.doesNotMatch(empty,/role="slider"/);
  assert.equal((empty.match(/aria-pressed="true"/g)||[]).length,2);
});

test('zooming around a rejected spike does not restore the spike or rescale to it', () => {
  const points = [2,2,2,16,2,2,2].map((speed,i)=>point(i*1000,speed));
  const html = renderToStaticMarkup(<ReplaySpeedChart points={points} bounds={{start:0,end:6000}} window={{start:2000,end:4000}} at={3000} colors={{}} hidden={new Set()} toggle={()=>{}} seek={()=>{}} loading={false}/>);
  assert.match(html, /—.*kn/);
  assert.match(html, /replay-chart-axis[^>]*><span>4<\/span>/);
  assert.doesNotMatch(html, /<polyline/);
});

test('four visits plot four chronological segments per boat, omitting off-map speeds', () => {
  const points = ['one','two','three'].flatMap(boatId => Array.from({length: 12}, (_, i) => ({
    ...point(i * 1000, i % 3 === 2 ? 3 : 2, 'session', boatId),
    longitude: i % 3 === 2 ? 50 : 16,
  })));
  const props = {points, bounds:{start:0,end:11000}, window:{start:0,end:10000}, at:10000, colors:{}, hidden:new Set<string>(), toggle:()=>{}, seek:()=>{}, loading:false};
  const viewport = {south:42,north:44,west:15,east:17};
  const html = renderToStaticMarkup(<ReplaySpeedChart {...props} viewport={viewport}/>);
  assert.equal((html.match(/<polyline/g) ?? []).length, 12);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 3);
  assert.match(html, /replay-chart-axis[^>]*><span>4<\/span>/);
  assert.match(html, /points="900.00,[^ ]+ 1000.00,/);
  const hidden = renderToStaticMarkup(<ReplaySpeedChart {...props} viewport={viewport} hidden={new Set(['two'])}/>);
  assert.equal((hidden.match(/<polyline/g) ?? []).length, 8);
  const full = renderToStaticMarkup(<ReplaySpeedChart {...props}/>);
  assert.equal((full.match(/<polyline/g) ?? []).length, 3);
});
