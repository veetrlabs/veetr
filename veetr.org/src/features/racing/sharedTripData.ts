export type TripSample = {
  recordedAt: string;
  latitude: number;
  longitude: number;
  sogMps: number | null;
  instruments?: {
    aws?: number | null;
    tws?: number | null;
    awa?: number | null;
    twa?: number | null;
  };
};
export type TripMetric = "sog" | "aws" | "tws" | "awa" | "twa";
export function tripMetric(p: TripSample, key: TripMetric) {
  const n =
    key === "sog"
      ? p.sogMps == null
        ? null
        : p.sogMps * 1.94384449
      : p.instruments?.[key];
  return n == null || !Number.isFinite(n) ? null : n;
}
export function sharedDistance(points: TripSample[]) {
  let metres = 0;
  const r = Math.PI / 180;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (Date.parse(b.recordedAt) - Date.parse(a.recordedAt) > 60000) continue;
    const h =
      Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
      Math.cos(a.latitude * r) *
        Math.cos(b.latitude * r) *
        Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
    metres += 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  return metres / 1852;
}
export function tripPlot(
  points: TripSample[],
  metric: TripMetric,
  scaleMax?: number,
) {
  const angles = metric === "awa" || metric === "twa",
    min = angles ? -180 : 0;
  let max = angles ? 180 : 1;
  for (const p of points) max = Math.max(max, tripMetric(p, metric) ?? 0);
  if (scaleMax !== undefined) max = Math.max(max, scaleMax);
  const start = Date.parse(points[0]?.recordedAt),
    duration = Math.max(1, Date.parse(points.at(-1)?.recordedAt ?? "") - start);
  let d = "",
    previous: number | null = null;
  let penDown = false;
  const step = Math.max(1, Math.ceil(points.length / 600));
  points.forEach((p, i) => {
    const v = tripMetric(p, metric),
      time = Date.parse(p.recordedAt);
    if (v === null || (previous !== null && time - previous > 60000))
      penDown = false;
    previous = time;
    if (v === null) return;
    if (i % step !== 0 && i !== points.length - 1) return;
    d += `${penDown ? "L" : "M"}${((600 * (time - start)) / duration).toFixed(1)},${(140 - (140 * (v - min)) / (max - min)).toFixed(1)} `;
    penDown = true;
  });
  return { d, min, max, unit: angles ? "°" : "kn" };
}

// Signed TWA is the direction wind comes FROM relative to the bow.
// COG is not a substitute for heading when positioning the wind arrow.
export function boatOrientation(p: {
  cogDeg?: number | null;
  instruments?: { heading?: number | null; twa?: number | null };
}) {
  const valid = (n: number | null | undefined): n is number =>
    n != null && Number.isFinite(n);
  const normalize = (n: number) => ((n % 360) + 360) % 360;
  const h = p.instruments?.heading,
    twa = p.instruments?.twa;
  const heading = valid(h)
    ? normalize(h)
    : valid(p.cogDeg)
      ? normalize(p.cogDeg)
      : null;
  return {
    heading,
    courseOnly: !valid(h) && heading !== null,
    windFrom: valid(h) && valid(twa) ? normalize(h + twa) : null,
  };
}
