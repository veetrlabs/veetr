import type { TrackingPoint } from '../tracking/model';

export type MotionState = 'quiet' | 'moving' | 'unknown';

// Acceleration can corroborate low-speed GPS noise; it cannot measure velocity.
// Keep unknown distinct from quiet (missing, stale or invalid sensor samples).
export function createMotionWindow() {
  let samples: { at: number; magnitude: number }[] = [];
  return {
    reset() { samples = []; },
    add(x: number, y: number, z: number, at: number) {
      const magnitude = Math.hypot(x, y, z); // m/s², including gravity
      if (!Number.isFinite(magnitude) || magnitude < 7 || magnitude > 13) {
        samples = [];
        return;
      }
      if (samples.length && at <= samples[samples.length - 1].at) return;
      samples = [...samples.filter(s => at - s.at <= 3000), { at, magnitude }];
    },
    state(at: number): MotionState {
      const recent = samples.filter(s => at >= s.at && at - s.at <= 3000);
      if (recent.length < 10 || at - recent[recent.length - 1].at > 600 ||
          recent[recent.length - 1].at - recent[0].at < 2000) return 'unknown';
      const mean = recent.reduce((sum, s) => sum + s.magnitude, 0) / recent.length;
      const variance = recent.reduce((sum, s) => sum + (s.magnitude - mean) ** 2, 0) / recent.length;
      const range = Math.max(...recent.map(s => s.magnitude)) - Math.min(...recent.map(s => s.magnitude));
      return Math.sqrt(variance) < 0.12 && range < 0.4 ? 'quiet' : 'moving';
    },
  };
}

function distance(a: TrackingPoint, b: TrackingPoint) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) *
    Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function createSpeedFilter() {
  let history: TrackingPoint[] = [];
  let lastTime = 0;
  let last: TrackingPoint | null = null;
  return (point: TrackingPoint, motion: MotionState = 'unknown'): TrackingPoint => {
    if (point.source !== 'phone') return point;
    const at = Date.parse(point.recordedAt);
    if (at === lastTime && last) return last;
    // New sessions, suspended apps and out-of-order batches must not inherit stillness.
    if (at < lastTime || at - lastTime > 15000) history = [];
    lastTime = at;
    history = history.filter(p => at - Date.parse(p.recordedAt) <= 30000);
    const anchor = history[0];
    const span = anchor ? at - Date.parse(anchor.recordedAt) : 0;
    const uncertainty = Math.max(3, (point.accuracyM ?? 100) + (anchor?.accuracyM ?? 100));
    const displaced = !!anchor && span >= 5000 && distance(anchor, point) > uncertainty;
    history.push(point);
    const speed = point.sogMps;
    let filtered = speed;
    if (speed !== null) {
      if (!displaced && speed < 0.15) filtered = 0; // ~0.29 kn GPS noise floor
      else if (!displaced && span >= 5000 && motion === 'quiet' && speed < ((point.accuracyM ?? 100) <= 25 ? 0.3 : 0.6)) filtered = 0;
      else if (point.accuracyM === null || point.accuracyM > 25) filtered = null;
    }
    last = { ...point, sogMps: filtered, cogDeg: filtered === null || filtered < 0.5 ? null : point.cogDeg };
    return last;
  };
}
