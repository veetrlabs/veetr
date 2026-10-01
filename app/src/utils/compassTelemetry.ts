export interface CompassTelemetry {
  rawHeading: number | null;
  accuracyRad: number | null;
  quality: number;
  status?: "good" | "uncertain" | "unavailable";
  rejected: number | null;
  receivedAt: number;
}
export function compassTelemetry(data: Record<string, unknown>, now = Date.now()): CompassTelemetry | undefined {
  const number = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
  const quality = number(data.hQ ?? data.hdgQuality, 0, 3);
  if (quality === null || !Number.isInteger(quality)) return undefined;
  const raw = number(data.hR ?? data.hdgRaw, 0, 359.999);
  const status = data.hQ === undefined ? {} : { status: (number(data.HDM, 0, 359) !== null ? 'good' : number(data.hR, 0, 359.999) !== null ? 'uncertain' : 'unavailable') as 'good' | 'uncertain' | 'unavailable' };
  return { quality, ...status, rawHeading: raw, accuracyRad: number(data.hdgAccuracyRad, 0, Math.PI), rejected: number(data.hdgRejected, 0, 4294967295), receivedAt: now };
}

/** Never promote legacy raw diagnostics (which may be stale) into a live bearing. */
export function visibleVaneHeading(heading: number | null, compass?: CompassTelemetry) {
  if (compass?.status === 'unavailable') return { heading: null, uncertain: false };
  if (compass?.status === 'uncertain') return { heading: compass.rawHeading, uncertain: compass.rawHeading !== null };
  return { heading, uncertain: false };
}
