import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replayRequests} from './replayRequests';
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
test('scrubbing displays intermediate frames, serializes requests, and fetches the final seek', async () => {
  const frames: number[] = [];
  let finish!: () => void;
  const queue = replayRequests(at => {
    frames.push(at);
    return new Promise<void>(resolve => { finish = resolve; });
  }, 0);
  queue.request(10);
  await tick();
  assert.deepEqual(frames, [10]);
  queue.request(20);
  queue.request(30);
  await tick();
  assert.deepEqual(frames, [10]); // one in flight
  finish();
  await tick();
  assert.deepEqual(frames, [10, 30]); // newest seek wins, without waiting for dragging to stop
  queue.request(40);
  finish();
  await tick();
  assert.deepEqual(frames, [10, 30, 40]);
  queue.dispose();
  finish();
});
test('disposing cancels pending frames', async () => {
  const frames: number[] = [];
  const queue = replayRequests(async at => { frames.push(at); });
  queue.request(1);
  queue.dispose();
  await tick();
  assert.deepEqual(frames, []);
});
