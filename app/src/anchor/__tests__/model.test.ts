import { AnchorFix, chooseFix, defaults, distanceM, restoreState, usableFix, validateSettings } from '../model';
const now = 100000;
const phone: AnchorFix = { latitude: 43, longitude: 16, timestamp: now, accuracy: 8, source: 'phone' };
const vane: AnchorFix = { ...phone, source: 'vane', accuracy: null };
it('prefers fresh Vane and falls back to phone when Vane is stale', () => {
  expect(chooseFix(phone, vane, now)?.source).toBe('vane');
  expect(chooseFix(phone, { ...vane, timestamp: now - 31000 }, now)?.source).toBe('phone');
  expect(chooseFix(phone, vane, now + 31000)).toBeNull();
});
it.each([{ latitude: NaN }, { longitude: 181 }, { accuracy: 100 }, { accuracy: -1 }, { accuracy: null }, { timestamp: now + 2000 }, { timestamp: NaN }])('rejects unreliable phone GPS: %j', patch => {
  expect(usableFix({ ...phone, ...patch }, now)).toBe(false);
});
it('measures metres across the date line and near the poles', () => {
  expect(distanceM({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 })).toBeCloseTo(222.39, 1);
  expect(distanceM(phone, phone)).toBe(0);
  expect(Number.isFinite(distanceM({ latitude: 90, longitude: 180 }, { latitude: -90, longitude: -180 }))).toBe(true);
});
it('restores chain, margin, anchor and armed alarm across launches', () => {
  const value = { ...defaults, anchor: { latitude: 0, longitude: 0 }, chainM: 72.5, marginM: 18, armed: true, alarm: true };
  expect(restoreState(JSON.stringify(value))).toEqual(value);
});
it('rejects corrupt or invalid settings rather than pretending to monitor', () => {
  expect(() => restoreState('{')).toThrow();
  expect(() => restoreState(JSON.stringify({ ...defaults, armed: true }))).toThrow();
  expect(() => validateSettings({ ...defaults, chainM: NaN })).toThrow();
  expect(() => validateSettings({ ...defaults, marginM: -1 })).toThrow();
});
