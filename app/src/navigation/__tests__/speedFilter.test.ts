import { createMotionWindow, createSpeedFilter } from '../speedFilter';
import type { TrackingPoint } from '../../tracking/model';
const base = Date.parse('2026-09-21T12:00:00Z');
function point(seconds: number, speed = 0.05, accuracy = 4, metres = 0): TrackingPoint {
  return { recordedAt: new Date(base + seconds * 1000).toISOString(), latitude: 49 + metres / 111195,
    longitude: 14, accuracyM: accuracy, sogMps: speed, cogDeg: 90, source: 'phone' };
}
test('the screenshot speed rounds to zero even when reported accuracy is good', () => {
  expect(createSpeedFilter()(point(0)).sogMps).toBe(0);
});
test('quiet motion and stationary positions suppress persistent low speed', () => {
  const filter = createSpeedFilter();
  filter(point(0, 0.25), 'quiet');
  expect(filter(point(6, 0.25), 'quiet').sogMps).toBe(0);
});
test('poor GPS plus recent quiet motion suppresses drift; missing motion is unknown', () => {
  const filter = createSpeedFilter();
  filter(point(0, 0.5, 40), 'quiet');
  expect(filter(point(6, 0.5, 40), 'quiet').sogMps).toBe(0);
  expect(createSpeedFilter()(point(6, 2, 40)).sogMps).toBeNull();
});
test('a smooth moving boat is not stopped by a quiet accelerometer', () => {
  const filter = createSpeedFilter();
  filter(point(0, 2), 'quiet');
  expect(filter(point(6, 2, 4, 12), 'quiet').sogMps).toBe(2);
});
test('measured displacement preserves very slow movement', () => {
  const filter = createSpeedFilter();
  for (let t = 0; t <= 30; t += 5) filter(point(t, 0.12, 0.5, t * 0.12), 'quiet');
  expect(filter(point(30, 0.12, 0.5, 3.6), 'quiet').sogMps).toBe(0.12);
});
test('movement above the noise floor resumes immediately', () => {
  const filter = createSpeedFilter();
  filter(point(0), 'quiet');
  expect(filter(point(1, 1), 'moving').sogMps).toBe(1);
});
test('stationary jitter inside the accuracy radius is not evidence of travel', () => {
  const filter = createSpeedFilter();
  for (let t = 0; t < 10; t++) filter(point(t, 0.25, 5, t % 2 ? 2 : -2), 'quiet');
  expect(filter(point(10, 0.25, 5), 'quiet').sogMps).toBe(0);
});
test('unknown speed remains unknown, and COG is cleared for stationary/poor fixes', () => {
  expect(createSpeedFilter()({ ...point(0), sogMps: null }).sogMps).toBeNull();
  expect(createSpeedFilter()(point(0)).cogDeg).toBeNull();
  expect(createSpeedFilter()(point(0, 2, 40)).cogDeg).toBeNull();
});
test('a gap or backwards timestamp does not inherit stationary history', () => {
  const filter = createSpeedFilter();
  filter(point(0, 0.25), 'quiet');
  filter(point(6, 0.25), 'quiet');
  expect(filter(point(30, 0.25), 'quiet').sogMps).toBe(0.25);
  expect(filter(point(1, 0.25), 'quiet').sogMps).toBe(0.25);
});
test('BLE speed is not filtered using phone motion', () => {
  const p = { ...point(0), source: 'veetr' as const };
  expect(createSpeedFilter()(p, 'quiet')).toBe(p);
});
test('motion needs enough recent, valid gravity samples', () => {
  const motion = createMotionWindow();
  expect(motion.state(base)).toBe('unknown');
  for (let t = 0; t <= 2200; t += 200) motion.add(0, 0, 9.81, base + t);
  expect(motion.state(base + 2200)).toBe('quiet');
  expect(motion.state(base + 4000)).toBe('unknown');
  expect(motion.state(base - 1)).toBe('unknown');
  motion.add(NaN, 0, 0, base + 4200);
  expect(motion.state(base + 4200)).toBe('unknown');
});
test('vibration is moving rather than quiet', () => {
  const motion = createMotionWindow();
  for (let t = 0; t <= 2200; t += 200) motion.add(0, 0, t % 400 ? 9 : 10.5, base + t);
  expect(motion.state(base + 2200)).toBe('moving');
});
