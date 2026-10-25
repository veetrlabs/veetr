import type { LocationFix, TrackingPoint } from '../tracking/model';
import type { MotionState } from '../navigation/speedFilter';

export const qualityReasons = ['accepted', 'rejected_fix', 'speed_unavailable', 'low_speed_noise', 'poor_accuracy', 'speed_uncertainty'] as const;
export type TrackingQuality = {
  version: 1; ageSeconds: number; rawSpeedMps: number | null; speedMps: number | null;
  rawCourseDeg: number | null; courseDeg: number | null; accuracyM: number | null;
  speedAccuracyMps: number | null; deliveryDelayMs: number | null;
  motion: MotionState; reason: typeof qualityReasons[number];
};
export type StoredQuality = Omit<TrackingQuality, 'ageSeconds'> & { at: number };
const number = (v: unknown, max: number): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : null;
export function qualitySample(fix: LocationFix, point: TrackingPoint | null, motion: MotionState, now = Date.now()): StoredQuality {
  return { version: 1, at: now,
    rawSpeedMps: number(fix.coords.speed, 1000), speedMps: number(point?.sogMps, 1000),
    rawCourseDeg: number(fix.coords.heading, 360), courseDeg: number(point?.cogDeg, 360),
    accuracyM: number(fix.coords.accuracy, 100000), speedAccuracyMps: null,
    deliveryDelayMs: number(now - fix.timestamp, 10000000), motion,
    reason: !point ? 'rejected_fix' : point.sogMps === 0 && (fix.coords.speed ?? 0) > 0 ? 'low_speed_noise' :
      point.sogMps === null ? (fix.coords.accuracy !== null && fix.coords.accuracy > 25 ? 'poor_accuracy' : 'speed_unavailable') : 'accepted',
  };
}
// Explicit allowlist: native bridge changes must never leak coordinates or IDs.
export function sanitizeQuality(raw: unknown): TrackingQuality[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(r => r && r.version === 1 && typeof r.ageSeconds === 'number' && r.ageSeconds >= 0 && r.ageSeconds <= 604800 &&
    ['quiet', 'moving', 'unknown'].includes(r.motion) && qualityReasons.includes(r.reason)).slice(-32).map(r => ({
      version: 1, ageSeconds: Math.floor(r.ageSeconds), rawSpeedMps: number(r.rawSpeedMps, 1000), speedMps: number(r.speedMps, 1000),
      rawCourseDeg: number(r.rawCourseDeg, 360), courseDeg: number(r.courseDeg, 360), accuracyM: number(r.accuracyM, 100000),
      speedAccuracyMps: number(r.speedAccuracyMps, 1000), deliveryDelayMs: number(r.deliveryDelayMs, 10000000), motion: r.motion, reason: r.reason,
    }));
}
export function qualitySnapshot(entries: StoredQuality[] = [], now = Date.now()): TrackingQuality[] {
  return sanitizeQuality(entries.map(({ at, ...entry }) => ({ ...entry, ageSeconds: Math.max(0, Math.floor((now - at) / 1000)) })));
}
