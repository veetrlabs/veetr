import type { TrackingPoint } from './model';
import type { MapRegion } from '../maps/headingRay';
import { inMapViewport } from '../../../veetr.org/src/features/racing/mapChartWindow';
import { routeGeometry } from '../../../veetr.org/src/features/racing/routeGeometry';
export type TimeWindow = [number, number];

/** Include visible estimated bridges in the timeline, without inventing readings.
 * Times on a bridge are interpolated solely to place the chart's boundaries.
 */
export function chartTimeBounds(points: TrackingPoint[], region?: MapRegion): TimeWindow {
  const visible = chartEntries(points, undefined, region);
  let start = Date.parse(visible[0]?.point.recordedAt || '');
  let end = Date.parse(visible.at(-1)?.point.recordedAt || '');
  if (!region) return [start, end];
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360));
  const south = mercator(region.latitude - region.latitudeDelta / 2);
  const north = mercator(region.latitude + region.latitudeDelta / 2);
  const wrap = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180;
  for (const section of routeGeometry(points)) {
    if (!section.estimated) continue;
    for (let i = 1; i < section.points.length; i++) {
      const a = section.points[i - 1], b = section.points[i];
      const x = wrap(a.longitude - region.longitude);
      const dx = wrap(b.longitude - a.longitude);
      const y = mercator(a.latitude), dy = mercator(b.latitude) - y;
      // Clip the projected bridge to the map rectangle, including date-line views.
      for (const shift of [-360, 0, 360]) {
        let enter = 0, exit = 1;
        for (const [origin, delta, low, high] of [
          [x + shift, dx, -region.longitudeDelta / 2, region.longitudeDelta / 2],
          [y, dy, south, north],
        ]) {
          if (delta === 0) { if (origin < low || origin > high) exit = -1; }
          else {
            const first = (low - origin) / delta, last = (high - origin) / delta;
            enter = Math.max(enter, Math.min(first, last));
            exit = Math.min(exit, Math.max(first, last));
          }
        }
        if (enter > exit) continue;
        const at = Date.parse(a.recordedAt), duration = Date.parse(b.recordedAt) - at;
        start = Math.min(Number.isFinite(start) ? start : Infinity, at + enter * duration);
        end = Math.max(Number.isFinite(end) ? end : -Infinity, at + exit * duration);
      }
    }
  }
  return [start, end];
}
export function chartEntries(points: TrackingPoint[], window?: TimeWindow, region?: MapRegion) {
  const viewport = region ? {
    south: region.latitude - region.latitudeDelta / 2,
    north: region.latitude + region.latitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
  } : undefined;
  return points.map((point, index) => ({ point, index })).filter(({ point }) => {
    const time = Date.parse(point.recordedAt);
    return inMapViewport(point, viewport) && (!window || (time >= window[0] && time <= window[1]));
  });
}
export function zoomWindow(bounds: TimeWindow, current: TimeWindow, scale: number, anchor = 0.5): TimeWindow {
  const full = bounds[1] - bounds[0];
  const span = Math.min(full, Math.max(Math.min(1000, full), (current[1] - current[0]) / Math.max(0.01, scale)));
  const start = Math.max(bounds[0], Math.min(bounds[1] - span, current[0] + anchor * (current[1] - current[0] - span)));
  return [start, start + span];
}
