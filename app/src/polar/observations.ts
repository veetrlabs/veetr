import { propulsionAt, propulsionSections } from "../tracking/propulsion";
import type { TrackingPoint, TrackingSession } from "../tracking/model";
import type { SailingObservation } from "../../../packages/shared/src/polar/model";
export function tripObservations(
  session: TrackingSession,
  points: TrackingPoint[],
): SailingObservation[] {
  return points.map((p) => ({
    id: `${session.id}/${p.recordedAt}`,
    sessionId: `${session.id}/${Math.max(0, propulsionSections(session).filter(s => Date.parse(s.startedAt) <= Date.parse(p.recordedAt)).length - 1)}`,
    boatId: session.boatId,
    timestamp: Date.parse(p.recordedAt),
    tws: p.instruments?.tws ?? NaN,
    twa: p.instruments?.twa ?? NaN,
    speed: p.sogMps == null ? NaN : p.sogMps * 1.94384449,
    heading: p.instruments?.heading ?? p.cogDeg,
    accuracyM: p.accuracyM,
    heel: p.instruments?.heel,
    gpsValid: p.sogMps !== null,
    windValid: p.instruments?.tws != null && p.instruments?.twa != null,
    engine: propulsionAt(session, p.recordedAt) === "engine-used" ? true : propulsionAt(session, p.recordedAt) === "sailing-only" ? false : undefined,
  }));
}
