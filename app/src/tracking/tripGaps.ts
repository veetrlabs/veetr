import type { TrackingPoint } from './model';

/** Gaps describe missing samples, not their cause. Ignore normal GPS jitter. */
export function tripGaps(points: TrackingPoint[]) {
  const times = points.map(p => Date.parse(p.recordedAt)).filter(Number.isFinite).sort((a, b) => a - b);
  return times.slice(1).flatMap((end, i) => end - times[i] > 30000
    ? [{ start: times[i], end, duration: end - times[i] }] : []);
}
