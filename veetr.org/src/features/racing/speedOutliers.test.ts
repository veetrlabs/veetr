import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterSpeedOutliers } from './speedOutliers';
import type { TrackPoint } from './trackCache';
const rows = (speeds: (number | null)[], step = 1000): TrackPoint[] => speeds.map((sogMps, i) => ({ boatId: 'a', boatName: 'A', sessionId: 's', recordedAt: new Date(i * step).toISOString(), sogMps, latitude: 43, longitude: 16, accuracyM: 5, cogDeg: 0, source: 'phone' }));
const speeds = (points: TrackPoint[]) => filterSpeedOutliers(points).map(p => p.sogMps);
test('isolated speed spike is omitted without mutating the recording', () => {
  const input = rows([2, 2.1, 2, 16, 2.2, 2, 2]);
  assert.deepEqual(speeds(input), [2, 2.1, 2, null, 2.2, 2, 2]);
  assert.equal(input[3].sogMps, 16);
});
test('keeps sustained high speeds, ramps, stops and modest variations', () => {
  for (const values of [[2,2,2,16,16,16,16,16,16], [1,2,3,4,5,6,7], [3,3,3,0,3,3,3], [2,2,2,3,2,2,2]]) {
    assert.deepEqual(speeds(rows(values)), values);
  }
});
test('leaves insufficient, missing and sparse context alone', () => {
  for (const input of [rows([2,2,16,2,2]), rows([2,null,2,16,2,2,2]), rows([2,2,2,16,2,2,2],10000)]) {
    assert.deepEqual(speeds(input), input.map(p=>p.sogMps));
  }
});
test('never mixes boats or recording sessions', () => {
  for (const field of ['boatId', 'sessionId'] as const) {
    const input = rows([2,2,2,16,2,2,2]);
    input[3] = {...input[3], [field]: 'other'};
    assert.equal(speeds(input)[3], 16);
  }
});
