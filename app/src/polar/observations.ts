import type { TrackingPoint, TrackingSession } from "../tracking/model";
import type { SailingObservation } from "../../../packages/shared/src/polar/model";
export function tripObservations(
  session: TrackingSession,
  points: TrackingPoint[],
): SailingObservation[] {
  return points.map((p) => ({
    id: `${session.id}/${p.recordedAt}`,
    sessionId: session.id,
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
    // Only explicitly selected sailing-only trips are passed to this adapter.
    engine: false,
  }));
}
