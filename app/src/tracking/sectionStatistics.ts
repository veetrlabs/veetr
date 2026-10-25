import type { TrackingPoint } from './model';
import type { PropulsionSection } from './propulsion';
import { metricValue } from './trip';

/** Each boundary belongs to the section on its right; the last includes the final fix.
 * Averages use valid recorded samples, without filling gaps or treating missing values as zero.
 */
export function sectionStatistics(points: TrackingPoint[], sections: PropulsionSection[], index: number) {
  const start = index === 0 ? -Infinity : Date.parse(sections[index]?.startedAt);
  const end = sections[index + 1] ? Date.parse(sections[index + 1].startedAt) : Infinity;
  const samples = points.filter(p => {
    const at = Date.parse(p.recordedAt);
    return Number.isFinite(at) && at >= start && at < end;
  });
  return speedStatistics(samples);
}

export function speedStatistics(samples: TrackingPoint[]) {
  return (['sog', 'aws', 'tws'] as const).map(metric => {
    let min = Infinity, max = -Infinity, sum = 0, count = 0;
    for (const point of samples) {
      const value = metricValue(point, metric);
      if (value === null) continue;
      min = Math.min(min, value); max = Math.max(max, value); sum += value; count++;
    }
    return { metric, min: count ? min : null, max: count ? max : null, average: count ? sum / count : null };
  });
}
