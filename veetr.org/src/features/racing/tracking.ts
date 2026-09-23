export interface TrackingPosition {
  boatId: string;
  boatName: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  sogMps: number | null;
  cogDeg: number | null;
  source: "phone" | "veetr";
  trail: [number, number][];
  trailSegments?: [number, number][][];
  futureFixes?: {recordedAt: string; latitude: number; longitude: number}[];
  nextFix?: {recordedAt: string; latitude: number; longitude: number} | null;
}
export function positionAge(
  position: Pick<TrackingPosition, "recordedAt">,
  now = Date.now(),
) {
  const stamp = Date.parse(position.recordedAt);
  return Number.isFinite(stamp)
    ? Math.max(0, Math.floor((now - stamp) / 1000))
    : Infinity;
}
export function parseTrackingPositions(value: unknown): TrackingPosition[] {
  if (!Array.isArray(value)) throw new Error("Invalid tracking response");
  const coordinate = (n: unknown, max: number) =>
    typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= max;
  for (const p of value) {
    if (
      !p ||
      typeof p.boatId !== "string" ||
      typeof p.boatName !== "string" ||
      !Number.isFinite(Date.parse(p.recordedAt)) ||
      !coordinate(p.latitude, 90) ||
      !coordinate(p.longitude, 180) ||
      (p.source === "phone" && p.accuracyM === null) ||
      (p.accuracyM !== null &&
        (!coordinate(p.accuracyM, 100) || p.accuracyM < 0)) ||
      (p.sogMps !== null && (!coordinate(p.sogMps, 100) || p.sogMps < 0)) ||
      (p.cogDeg !== null &&
        (!coordinate(p.cogDeg, 360) || p.cogDeg < 0 || p.cogDeg >= 360)) ||
      (p.source !== "phone" && p.source !== "veetr") ||
      (p.futureFixes != null && (!Array.isArray(p.futureFixes) || p.futureFixes.some(
        (f: TrackingPosition["nextFix"]) => !f || !Number.isFinite(Date.parse(f.recordedAt)) ||
          !coordinate(f.latitude,90) || !coordinate(f.longitude,180)))) ||
      (p.nextFix != null && (!Number.isFinite(Date.parse(p.nextFix.recordedAt)) ||
        !coordinate(p.nextFix.latitude, 90) || !coordinate(p.nextFix.longitude, 180))) ||
      !Array.isArray(p.trail) ||
      p.trail.some(
        (c: unknown) =>
          !Array.isArray(c) ||
          c.length !== 2 ||
          !coordinate(c[0], 90) ||
          !coordinate(c[1], 180),
      )
    )
      throw new Error("Invalid tracking response");
  }
  return value;
}

export function positionsForHeat(positions: TrackingPosition[], boatIds: string[]): TrackingPosition[] {
  const entered = new Set(boatIds);
  return positions.filter(position => entered.has(position.boatId));
}
