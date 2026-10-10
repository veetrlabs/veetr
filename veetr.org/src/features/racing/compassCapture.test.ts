import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompassCapture } from './compassCapture';
test('one press captures the touched reading despite invalid or expired sensor updates before click', () => {
  const capture = createCompassCapture();
  assert.equal(capture.begin({degrees:126.3,at:1000},5.1,3999),true);
  assert.equal(capture.holding,true);
  assert.ok(Math.abs(capture.take(null,5.1,4100,true)!-131.4)<1e-8);
  assert.equal(capture.holding,false);
  assert.equal(capture.take(null,5.1,4100),null);
});
test('cancelled gestures do not capture and keyboard clicks still use a fresh reading', () => {
  const capture = createCompassCapture();
  capture.begin({degrees:100,at:1000},5,1000);
  capture.cancel();
  assert.equal(capture.take({degrees:200,at:1500},5,1500,true),null);
  assert.equal(capture.take({degrees:200,at:1500},5,1500),205);
  assert.equal(capture.begin({degrees:100,at:1000},5,5000),false);
  assert.equal(capture.begin({degrees:100,at:6000},5,5000),false);
});
