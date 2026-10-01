export type Coordinate = { latitude: number; longitude: number };
export type AnchorFix = Coordinate & { timestamp: number; accuracy: number | null; source: 'phone' | 'vane' };
export type AnchorState = {
  anchor: Coordinate | null;
  chainM: number;
  marginM: number;
  armed: boolean;
  alarm: boolean;
};
export const defaults: AnchorState = { anchor: null, chainM: 30, marginM: 15, armed: false, alarm: false };
export const FRESH_MS = 30000;
export function coordinateValid(p: Coordinate): boolean {
  return Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
}
export function usableFix(p: AnchorFix | null, now: number): p is AnchorFix {
  return !!p && coordinateValid(p) && Number.isFinite(p.timestamp) &&
    now - p.timestamp <= FRESH_MS && p.timestamp <= now + 1000 &&
    (p.source === 'vane' || (p.accuracy !== null && Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= 50));
}
export function chooseFix(phone: AnchorFix | null, vane: AnchorFix | null, now: number) {
  return usableFix(vane, now) ? vane : usableFix(phone, now) ? phone : null;
}
export function distanceM(a: Coordinate, b: Coordinate) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function radiusM(s: AnchorState) { return s.chainM + s.marginM; }
export function validateSettings(s: AnchorState) {
  if (s.anchor && !coordinateValid(s.anchor)) throw new Error('Invalid anchor position.');
  if (!Number.isFinite(s.chainM) || s.chainM < 1 || s.chainM > 1000 ||
    !Number.isFinite(s.marginM) || s.marginM < 0 || s.marginM > 500)
    throw new Error('Enter a chain length from 1 to 1000 m and a margin from 0 to 500 m.');
}
export function restoreState(raw: string | null): AnchorState {
  if (!raw) return { ...defaults };
  const value = JSON.parse(raw);
  const s: AnchorState = { anchor: value.anchor ?? null, chainM: value.chainM, marginM: value.marginM,
    armed: value.armed === true, alarm: value.alarm === true };
  validateSettings(s);
  if (s.armed && !s.anchor) throw new Error('Saved anchor position is missing.');
  return s;
}
