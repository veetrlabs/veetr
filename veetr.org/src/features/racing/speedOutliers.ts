import type { TrackPoint } from './trackCache';

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
};

/** Conservative Hampel detection for display only. Never changes the stored fixes.
 * Require three close readings on each side, in the same continuous recording.
 * Only isolated upward spikes are rejected; stops and sustained acceleration remain.
 */
export function filterSpeedOutliers(points: TrackPoint[]): TrackPoint[] {
  const result = [...points].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  const groups = new Map<string, number[]>();
  result.forEach((point, index) => {
    const key = JSON.stringify([point.boatId, point.sessionId]);
    const indices = groups.get(key) ?? [];
    indices.push(index);
    groups.set(key, indices);
  });
  const rejected = new Set<number>();
  for (const indices of groups.values()) {
    for (let i = 3; i < indices.length - 3; i++) {
      const window = indices.slice(i - 3, i + 4).map(index => result[index]);
      const center = window[3];
      if (window.some(p => p.sogMps === null || !Number.isFinite(p.sogMps))) continue;
      // Avoid using remote samples across pauses, missing fixes, or sparse recordings.
      if (Date.parse(window[6].recordedAt) - Date.parse(window[0].recordedAt) > 30000) continue;
      if (window.some((p, j) => j > 0 && Date.parse(p.recordedAt) <= Date.parse(window[j - 1].recordedAt))) continue;
      const speeds = window.map(p => p.sogMps!);
      const mid = median(speeds);
      const threshold = Math.max(3, 3 * 1.4826 * median(speeds.map(speed => Math.abs(speed - mid))));
      // Both immediate neighbours must return to the local baseline. No smoothing.
      if (center.sogMps! > mid + threshold && speeds[2] <= mid + threshold / 2 && speeds[4] <= mid + threshold / 2) rejected.add(indices[i]);
    }
  }
  return result.map((point, index) => rejected.has(index) ? { ...point, sogMps: null } : point);
}
