import type { TrackingPoint } from './model';
import type { MapRegion } from '../maps/headingRay';
import { validCoordinate } from './trip';
export type TimeWindow = [number, number];
export function chartEntries(points: TrackingPoint[], region?: MapRegion, window?: TimeWindow) {
  return points.map((point, index) => ({ point, index })).filter(({ point }) => {
    const time = Date.parse(point.recordedAt);
    const longitudeDistance = region ? Math.abs(((point.longitude - region.longitude + 540) % 360) - 180) : 0;
    return (!window || (time >= window[0] && time <= window[1])) && (!region || (
      validCoordinate(point) && Math.abs(point.latitude - region.latitude) <= region.latitudeDelta / 2 &&
      longitudeDistance <= region.longitudeDelta / 2
    ));
  });
}
export function zoomWindow(bounds: TimeWindow, current: TimeWindow, scale: number, anchor = 0.5): TimeWindow {
  const full = bounds[1] - bounds[0];
  const span = Math.min(full, Math.max(Math.min(1000, full), (current[1] - current[0]) / Math.max(0.01, scale)));
  const start = Math.max(bounds[0], Math.min(bounds[1] - span, current[0] + anchor * (current[1] - current[0] - span)));
  return [start, start + span];
}
