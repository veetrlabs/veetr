import { phoneStartLineDistance } from '../startLineDistance'
import type { PhoneStartLine, StartMark } from '../phoneStartLine'
import type { TrackingPoint } from '../../tracking/model'
const now = Date.parse('2026-09-15T12:00:00Z')
const degree = 180 / (Math.PI * 6371000)
const mark = (latitude: number, longitude: number): StartMark => ({ latitude, longitude, accuracyM: 5, capturedAt: '2026-09-01T12:00:00Z' })
const line: PhoneStartLine = { port: mark(0, 0), starboard: mark(0, 100 * degree) }
const fix = (latitude: number, longitude: number): TrackingPoint => ({ latitude, longitude, accuracyM: 5, recordedAt: new Date(now).toISOString(), sogMps: null, cogDeg: null, source: 'phone' })
test('distance is perpendicular inside the segment and zero on the line', () => {
  expect(phoneStartLineDistance(line, fix(30 * degree, 50 * degree), now)).toBeCloseTo(30, 3)
  expect(phoneStartLineDistance(line, fix(0, 50 * degree), now)).toBeCloseTo(0, 3)
})
test('beyond the segment, distance uses the nearest endpoint', () => {
  expect(phoneStartLineDistance(line, fix(30 * degree, 140 * degree), now)).toBeCloseTo(50, 3)
})
test('distance is unsigned and does not depend on endpoint order', () => {
  expect(phoneStartLineDistance({ port: line.starboard, starboard: line.port }, fix(-30 * degree, 50 * degree), now)).toBeCloseTo(30, 3)
})
test('handles longitude scaling at high latitude and the date line', () => {
  const high = { port: mark(60, 0), starboard: mark(60, 200 * degree) }
  expect(phoneStartLineDistance(high, fix(60 + 30 * degree, 100 * degree), now)).toBeCloseTo(30, 3)
  const dateline = { port: mark(0, 179.999), starboard: mark(0, -179.999) }
  expect(phoneStartLineDistance(dateline, fix(30 * degree, 180), now)).toBeCloseTo(30, 3)
})
test('missing or degenerate line and stale or poor GPS never produce a false zero', () => {
  expect(phoneStartLineDistance({ ...line, port: null }, fix(0, 0), now)).toBeNull()
  expect(phoneStartLineDistance({ port: line.port, starboard: line.port }, fix(0, 0), now)).toBeNull()
  expect(phoneStartLineDistance(line, null, now)).toBeNull()
  expect(phoneStartLineDistance(line, fix(0, 0), now + 16000)).toBeNull()
  expect(phoneStartLineDistance(line, { ...fix(0, 0), accuracyM: 31 }, now)).toBeNull()
})
