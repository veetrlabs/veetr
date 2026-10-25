import { validSpeedMps } from './speed';
import type { TrackingPoint, TrackingSession } from "./model";
export type Trip = {
  archived?: boolean;
  session: TrackingSession;
  points: TrackingPoint[];
};
export const TRACK_GAP_MS = 60_000;
export function orderedPoints(points: TrackingPoint[]) {
  return points
    .filter((p) => Number.isFinite(Date.parse(p.recordedAt)))
    .slice()
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
}
export function validCoordinate(p: TrackingPoint) {
  return (
    Number.isFinite(p.latitude) &&
    Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.longitude) <= 180
  );
}
export function routeSegments(points: TrackingPoint[]) {
  const segments: TrackingPoint[][] = [];
  let current: TrackingPoint[] = [];
  for (const p of points) {
    if (!validCoordinate(p)) {
      current = [];
      continue;
    }
    if (
      !current.length ||
      Date.parse(p.recordedAt) -
        Date.parse(current[current.length - 1].recordedAt) >
        TRACK_GAP_MS
    ) {
      current = [];
      segments.push(current);
    }
    current.push(p);
  }
  return segments;
}
export function distanceNm(points: TrackingPoint[]) {
  let meters = 0;
  const rad = Math.PI / 180;
  for (const segment of routeSegments(points))
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1],
        b = segment[i];
      const h =
        Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
        Math.cos(a.latitude * rad) *
          Math.cos(b.latitude * rad) *
          Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
      meters += 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    }
  return meters / 1852;
}
export function durationLabel(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60
    ? `${m}m`
    : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
export function tripDuration(trip: Trip, now = Date.now()) {
  const end =
    trip.session.phase === "recording"
      ? now
      : Date.parse(
          trip.session.stoppedAt ||
            trip.points.at(-1)?.recordedAt ||
            trip.session.startedAt,
        );
  return Math.max(0, end - Date.parse(trip.session.startedAt));
}
// Select the nearest actual sample, never an interpolated speed or position.
export function nearestPoint(points: TrackingPoint[], time: number) {
  if (!points.length) return -1;
  let lo = 0,
    hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (Date.parse(points[mid].recordedAt) < time) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 &&
    time - Date.parse(points[lo - 1].recordedAt) <
      Date.parse(points[lo].recordedAt) - time
    ? lo - 1
    : lo;
}
export type Metric = "sog" | "aws" | "tws" | "awa" | "twa";
export function metricValue(p: TrackingPoint, metric: Metric): number | null {
  const v =
    metric === "sog"
      ? validSpeedMps(p.sogMps) === null
        ? null
        : p.sogMps! * 1.94384449
      : p.instruments?.[metric];
  return v != null && Number.isFinite(v) && ((metric === "awa" || metric === "twa") ? Math.abs(v) <= 180 : v >= 0) ? v : null;
}
export function chartPath(
  points: TrackingPoint[],
  metric: Metric,
  max: number,
  width = 320,
  height = 140,
  min = 0,
  originalIndices?: number[],
  timeBounds?: [number, number],
) {
  const start = timeBounds?.[0] ?? Date.parse(points[0]?.recordedAt),
    end = timeBounds?.[1] ?? Date.parse(points.at(-1)?.recordedAt || "");
  let previous: number | null = null;
  const commands: string[] = [];
  // One mean per four chart units: wider time intervals in the overview,
  // narrower intervals when zoomed in. Only the rendered line is averaged.
  const averageSpeed = metric === 'sog' || metric === 'aws' || metric === 'tws';
  let count = 0, sumX = 0, sumY = 0;
  let column = -1;
  let newSegment = true;
  function flush() {
    if (!count) return;
    commands.push(`${newSegment ? "M" : "L"}${(sumX / count).toFixed(2)},${(sumY / count).toFixed(2)} `);
    newSegment = false;
    count = 0; sumX = 0; sumY = 0;
  }
  for (const [index, p] of points.entries()) {
    const v = metricValue(p, metric), t = Date.parse(p.recordedAt);
    const gap = previous === null || t - previous > TRACK_GAP_MS ||
      (originalIndices && index > 0 && originalIndices[index] !== originalIndices[index - 1] + 1);
    if (gap || v === null || !Number.isFinite(t)) { flush(); newSegment = true; }
    if (v === null || !Number.isFinite(t)) { previous = null; continue; }
    const x = width * (t - start) / Math.max(1, end - start);
    const nextColumn = averageSpeed ? Math.floor(x / 4) : index;
    if (nextColumn !== column) { flush(); column = nextColumn; }
    sumX += x;
    sumY += height - height * (v - min) / Math.max(0.001, max - min);
    count++;
    previous = t;
  }
  flush();
  return commands.join("");
}
