import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceReplay, parseReplay } from './replay';
test('replay handles missing history and rejects invalid or reversed bounds', () => {
  assert.deepEqual(parseReplay({start:null,end:null,positions:[]}), {start:null,end:null,positions:[]});
  for (const value of [null, {}, {start:'bad',end:null,positions:[]}, {start:'2026-09-23',end:'2026-09-22',positions:[]}, {start:'2026-09-22',end:null,positions:[]}]) assert.throws(() => parseReplay(value));
});
test('playback advances at selected speed and stops exactly at final point', () => {
  assert.equal(advanceReplay(1000, 100000, 30),31000);
  assert.equal(advanceReplay(99000,100000,30),100000);
  assert.equal(advanceReplay(100000,100000,1),100000);
});

import {replayCoordinate} from './replay';
import type {TrackingPosition} from './tracking';
const fix = {recordedAt:'2026-09-22T12:00:00Z',latitude:10,longitude:20,
  nextFix:{recordedAt:'2026-09-22T12:00:20Z',latitude:12,longitude:24}} as TrackingPosition;
test('replay interpolates between GPS fixes and clamps rather than extrapolating', () => {
  assert.deepEqual(replayCoordinate(fix, Date.parse('2026-09-22T12:00:10Z')), [11,22]);
  assert.deepEqual(replayCoordinate(fix, Date.parse('2026-09-22T11:59:00Z')), [10,20]);
  assert.deepEqual(replayCoordinate(fix, Date.parse('2026-09-22T12:00:30Z')), [12,24]);
  assert.deepEqual(replayCoordinate({...fix,nextFix:null}, Date.parse('2026-09-22T12:00:10Z')), [10,20]);
  assert.deepEqual(replayCoordinate({...fix,nextFix:{...fix.nextFix!,recordedAt:'2026-09-22T12:05:00Z'}}, Date.parse('2026-09-22T12:00:10Z')), [10,20]);
});
test('interpolation crosses the date line by the short path', () => {
  const p = {...fix,longitude:179,nextFix:{...fix.nextFix!,longitude:-179}};
  assert.deepEqual(replayCoordinate(p, Date.parse('2026-09-22T12:00:10Z')), [11,-180]);
});
test('fast playback follows intermediate fixes rather than cutting across the whole path', () => {
  const p = {...fix, futureFixes:[
    {recordedAt:'2026-09-22T12:00:40Z',latitude:14,longitude:20},
    {recordedAt:'2026-09-22T12:01:00Z',latitude:16,longitude:24},
  ]};
  assert.deepEqual(replayCoordinate(p,Date.parse('2026-09-22T12:00:30Z')), [13,22]);
  assert.deepEqual(replayCoordinate(p,Date.parse('2026-09-22T12:00:50Z')), [15,22]);
});
