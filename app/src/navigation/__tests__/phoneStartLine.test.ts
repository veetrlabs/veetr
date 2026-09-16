import { canCapturePhone, capturePhoneMark, emptyLine, parsePhoneLine } from '../phoneStartLine'
import type { TrackingPoint } from '../../tracking/model'
const now = Date.parse('2026-09-15T12:00:00Z')
const point: TrackingPoint = { latitude: 0, longitude: 14, recordedAt: new Date(now).toISOString(), accuracyM: 5, sogMps: null, cogDeg: null, source: 'phone' }
test('captures a stationary phone without speed or course, including equator coordinates', () => {
  expect(capturePhoneMark(point, now)).toEqual({ latitude: 0, longitude: 14, capturedAt: point.recordedAt, accuracyM: 5 })
})
test.each([
  { recordedAt: new Date(now - 15001).toISOString() },
  { recordedAt: new Date(now + 2000).toISOString() },
  { accuracyM: 31 }, { accuracyM: -1 }, { latitude: NaN }, { longitude: 181 },
])('rejects stale, inaccurate or invalid fixes: %s', patch => {
  expect(canCapturePhone({ ...point, ...patch }, now)).toBe(false)
  expect(() => capturePhoneMark({ ...point, ...patch }, now)).toThrow()
})
test('saved marks survive serialization and age; clearing one preserves the other', () => {
  const mark = capturePhoneMark(point, now)
  const both = { port: mark, starboard: { ...mark, longitude: 14.01 } }
  expect(parsePhoneLine(JSON.stringify(both))).toEqual(both)
  expect(parsePhoneLine(JSON.stringify({ ...both, port: null }))).toEqual({ port: null, starboard: both.starboard })
  expect(parsePhoneLine(null)).toEqual(emptyLine())
})
test('rejects damaged storage rather than displaying invalid line coordinates', () => {
  expect(() => parsePhoneLine('{')).toThrow()
  expect(() => parsePhoneLine(JSON.stringify({ port: { latitude: 999 }, starboard: null }))).toThrow()
})
