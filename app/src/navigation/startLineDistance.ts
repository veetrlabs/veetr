import { canCapturePhone, type PhoneStartLine } from './phoneStartLine'
import type { TrackingPoint } from '../tracking/model'
const R = 6371000
const rad = Math.PI / 180
const longitudeDelta = (a: number, b: number) => ((a - b + 540) % 360) - 180

// Shortest distance to the finite start-line segment, including its endpoints.
// A local metre projection accounts for longitude scale and crossing the date line.
export function phoneStartLineDistance(line: PhoneStartLine, point: TrackingPoint | null, now = Date.now()): number | null {
  if (!line.port || !line.starboard || !canCapturePhone(point, now)) return null
  const a = line.port, b = line.starboard
  for (const mark of [a, b]) {
    if (!Number.isFinite(mark.latitude) || Math.abs(mark.latitude) > 90 || !Number.isFinite(mark.longitude) || Math.abs(mark.longitude) > 180) return null
  }
  const scale = Math.cos((a.latitude + b.latitude) * rad / 2)
  const bx = longitudeDelta(b.longitude, a.longitude) * rad * R * scale
  const by = (b.latitude - a.latitude) * rad * R
  const px = longitudeDelta(point.longitude, a.longitude) * rad * R * scale
  const py = (point.latitude - a.latitude) * rad * R
  const lengthSquared = bx * bx + by * by
  // Coincident endpoints do not define a usable start line.
  if (lengthSquared < 1) return null
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared))
  const distance = Math.hypot(px - t * bx, py - t * by)
  return Number.isFinite(distance) ? distance : null
}
