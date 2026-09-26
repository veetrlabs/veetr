import type { TrackingPoint } from "./model";
import type { SailingData } from "../context/BLEContext";
let latest: TrackingPoint | null = null;
let instruments: {at:number;values:TrackingPoint["instruments"]} | null = null;
export function clearDeviceRecordingSource() {
  latest = null;
  instruments = null;
}
export function deviceRecordingPoint(
  data: Partial<SailingData>,
  now = Date.now(),
): TrackingPoint | null {
  if (
    !data.gpsValid ||
    !Number.isFinite(data.lat) ||
    !Number.isFinite(data.lon) ||
    Math.abs(data.lat!) > 90 ||
    Math.abs(data.lon!) > 180
  )
    return null;
  return {
    recordedAt: new Date(now).toISOString(),
    latitude: data.lat!,
    longitude: data.lon!,
    accuracyM: null,
    sogMps:
      Number.isFinite(data.gpsSpeed) && data.gpsSpeed! >= 0
        ? data.gpsSpeed! / 1.94384449
        : null,
    cogDeg: data.course ?? null,
    source: "veetr",
    instruments: data.recordingInstruments ?? {
      awa: Number.isFinite(data.windAngle) ? data.windAngle! : null,
      twa: Number.isFinite(data.trueWindAngle) ? data.trueWindAngle! : null,
      heading: Number.isFinite(data.heading) ? data.heading! : null,
      aws: Number.isFinite(data.windSpeed) ? data.windSpeed! : null,
      tws: Number.isFinite(data.trueWindSpeed) ? data.trueWindSpeed! : null,
    },
  };
}
export function setDeviceRecordingSource(
  data: Partial<SailingData>,
  now = Date.now(),
) {
  instruments = data.recordingInstruments ? {at:now,values:data.recordingInstruments} : null;
  latest = deviceRecordingPoint(data, now);
  return latest;
}
export function preferredRecordingPoint(
  phone: TrackingPoint | null,
  now = Date.now(),
) {
  const stamp = latest ? Date.parse(latest.recordedAt) : 0;
  // Do not replace delayed background fixes with a newer device sample.
  return latest &&
    now - stamp <= 15000 &&
    now >= stamp &&
    (!phone || Math.abs(Date.parse(phone.recordedAt) - stamp) <= 5000)
    ? latest
    : phone && instruments && now-instruments.at>=0 && now-instruments.at<=15000 && Math.abs(Date.parse(phone.recordedAt)-instruments.at)<=5000
      ? {...phone,instruments:instruments.values}
      : phone;
}
