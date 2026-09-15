import type { TrackingPoint } from '../tracking/model'
export type StartMark = { latitude: number; longitude: number; accuracyM: number; capturedAt: string }
export type PhoneStartLine = { port: StartMark | null; starboard: StartMark | null }
export const emptyLine = (): PhoneStartLine => ({ port: null, starboard: null })
export function canCapturePhone(point: TrackingPoint | null, now = Date.now()): point is TrackingPoint {
  if (!point) return false
  const age = now - Date.parse(point.recordedAt)
  return Number.isFinite(age) && age >= -1000 && age <= 15000 &&
    Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180 &&
    point.accuracyM !== null && Number.isFinite(point.accuracyM) && point.accuracyM >= 0 && point.accuracyM <= 30
}
export function capturePhoneMark(point: TrackingPoint | null, now = Date.now()): StartMark {
  if (!canCapturePhone(point, now)) throw new Error('Wait for a fresh phone GPS fix with accuracy of 30 m or better.')
  return { latitude: point.latitude, longitude: point.longitude, accuracyM: point.accuracyM!, capturedAt: point.recordedAt }
}
export function parsePhoneLine(raw: string | null): PhoneStartLine {
  if (!raw) return emptyLine()
  const data = JSON.parse(raw)
  const mark = (value: unknown): StartMark | null => {
    if (value === null) return null
    const m = value as StartMark
    if (!m || !Number.isFinite(m.latitude) || Math.abs(m.latitude) > 90 || !Number.isFinite(m.longitude) || Math.abs(m.longitude) > 180 || !Number.isFinite(m.accuracyM) || m.accuracyM < 0 || m.accuracyM > 30 || !Number.isFinite(Date.parse(m.capturedAt))) throw new Error('Saved phone start line is invalid.')
    return m
  }
  return { port: mark(data?.port), starboard: mark(data?.starboard) }
}
