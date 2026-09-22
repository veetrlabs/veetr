import { parseTrackingPositions, type TrackingPosition } from './tracking';
export function parseReplay(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Invalid replay response');
  const v = value as {start: unknown; end: unknown; positions: unknown};
  const stamp = (x: unknown) => typeof x === 'string' && Number.isFinite(Date.parse(x)) ? Date.parse(x) : null;
  const start = stamp(v.start), end = stamp(v.end);
  if ((v.start !== null && start === null) || (v.end !== null && end === null) ||
      (start === null) !== (end === null) || (start !== null && end! < start)) throw new Error('Invalid replay response');
  return {start, end, positions: parseTrackingPositions(v.positions)};
}
export function advanceReplay(at: number, end: number, speed: number) {
  return Math.min(end, at + speed * 1000);
}


// Interpolate only between nearby fixes; never extrapolate across missing GPS data.
export function replayCoordinate(p: TrackingPosition, at: number): [number, number] {
  const candidates = [p.nextFix, ...(p.futureFixes ?? [])].filter(
    (fix): fix is NonNullable<TrackingPosition['nextFix']> => !!fix
  ).sort((a,b) => Date.parse(a.recordedAt)-Date.parse(b.recordedAt));
  let previous = p;
  for (const candidate of candidates) {
    if (Date.parse(candidate.recordedAt) >= at) break;
    previous = {...p, ...candidate};
  }
  p = previous;
  const start = Date.parse(p.recordedAt);
  const next = candidates.find(fix => Date.parse(fix.recordedAt) > start);
  const end = next ? Date.parse(next.recordedAt) : NaN;
  if (!next || !Number.isFinite(at) || end <= start || end - start > 60000)
    return [p.latitude, p.longitude];
  const fraction = Math.max(0, Math.min(1, (at - start) / (end - start)));
  const longitudeDelta = ((next.longitude - p.longitude + 540) % 360) - 180;
  return [p.latitude + (next.latitude - p.latitude) * fraction,
    ((p.longitude + longitudeDelta * fraction + 540) % 360) - 180];
}
