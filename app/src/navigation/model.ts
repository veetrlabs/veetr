import type { BLEState } from "../context/BLEContext";
import type { TrackingPoint } from "../tracking/model";
export const KNOTS_PER_MPS = 1.94384449;
export function navigationFix(
  phone: TrackingPoint | null,
  device: BLEState,
  recording: boolean,
  now: number,
) {
  const deviceFresh =
    device.isConnected &&
    device.lastMessageTime !== null &&
    now - device.lastMessageTime <= 15000;
  const p =
    phone &&
    now - Date.parse(phone.recordedAt) <= 15000 &&
    now >= Date.parse(phone.recordedAt) - 1000
      ? phone
      : null;
  const d = device.sailingData;
  const deviceFix =
    deviceFresh && d.gpsValid
      ? {
          latitude: d.lat,
          longitude: d.lon,
          sogKnots: Number.isFinite(d.gpsSpeed) ? d.gpsSpeed : null,
          course: d.course ?? null,
          accuracy: null,
          source: "Veetr GPS" as const,
        }
      : null;
  const phoneFix = p
    ? {
        latitude: p.latitude,
        longitude: p.longitude,
        sogKnots: p.sogMps === null ? null : p.sogMps * KNOTS_PER_MPS,
        course: p.cogDeg,
        accuracy: p.accuracyM,
        source:
          p.source === "veetr"
            ? ("Veetr GPS" as const)
            : ("Phone GPS" as const),
      }
    : null;
  // Prefer a fresh device fix; fall back to phone GPS during disconnects.
  return { fix: deviceFix ?? phoneFix, deviceFresh };
}
