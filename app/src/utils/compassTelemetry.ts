export interface CompassTelemetry {
  rawHeading: number | null;
  accuracyRad: number | null;
  quality: number;
  rejected: number | null;
  receivedAt: number;
}
export function compassTelemetry(data: Record<string, unknown>, now = Date.now()): CompassTelemetry | undefined {
  const number = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
  const quality = number(data.hdgQuality, 0, 3);
  if (quality === null || !Number.isInteger(quality)) return undefined;
  return { quality, rawHeading: number(data.hdgRaw, 0, 359.999), accuracyRad: number(data.hdgAccuracyRad, 0, Math.PI), rejected: number(data.hdgRejected, 0, 4294967295), receivedAt: now };
}
