export const UPLOAD_INTERVAL_MS = 20_000;
export const SAMPLE_INTERVAL_MS = 5_000;
export const MAX_PENDING_POINTS = 10_000;
export interface TrackingEntry {
  seriesId: string;
  seriesName: string;
  boatId: string;
  boatName: string;
}
export interface TrackingSession extends TrackingEntry {
  id: string;
  userId: string;
  mode?: "local" | "live";
  replayEnabled?: boolean;
  backgroundEnabled?: boolean;
  backgroundStartedAt?: string;
  lastBackgroundFixAt?: string;
  lastTaskError?: string;
  stopReason?: "user" | "expired";
  recentPoints?: TrackingPoint[];
  phase: "starting" | "recording" | "stopping";
  startedAt: string;
  expiresAt: string;
  stoppedAt?: string;
  lastRecordedAt?: string;
  lastUploadAt?: string;
  error?: string;
}
export interface TrackingPoint {
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  sogMps: number | null;
  cogDeg: number | null;
  source: "phone" | "veetr";
  instruments?: { aws: number | null; tws: number | null };
}
export interface LocationFix {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
  };
}
export function normalizeFix(
  fix: LocationFix,
  now = Date.now(),
): TrackingPoint | null {
  const c = fix.coords;
  if (
    !Number.isFinite(fix.timestamp) ||
    fix.timestamp <= 0 ||
    fix.timestamp > now + 30_000 ||
    !Number.isFinite(c.latitude) ||
    Math.abs(c.latitude) > 90 ||
    !Number.isFinite(c.longitude) ||
    Math.abs(c.longitude) > 180 ||
    c.accuracy === null ||
    !Number.isFinite(c.accuracy) ||
    c.accuracy < 0 ||
    c.accuracy > 100
  )
    return null;
  const speed =
    c.speed !== null &&
    Number.isFinite(c.speed) &&
    c.speed >= 0 &&
    c.speed <= 100
      ? c.speed
      : null;
  return {
    recordedAt: new Date(fix.timestamp).toISOString(),
    latitude: c.latitude,
    longitude: c.longitude,
    accuracyM: c.accuracy,
    sogMps: speed,
    cogDeg:
      speed !== null &&
      speed >= 0.5 &&
      c.heading !== null &&
      Number.isFinite(c.heading) &&
      c.heading >= 0 &&
      c.heading < 360
        ? c.heading
        : null,
    source: "phone",
  };
}
