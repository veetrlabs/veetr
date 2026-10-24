import type { TrackingPoint } from './model';
import type { MapRegion } from '../maps/headingRay';
import { inMapViewport } from '../../../veetr.org/src/features/racing/mapChartWindow';
export type TimeWindow = [number, number];
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
