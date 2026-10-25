import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import type { LocationFix, TrackingPoint, TrackingSession } from '../tracking/model';
import type { MotionState } from '../navigation/speedFilter';

export const DIAGNOSTIC_SCHEMA = 1;
export const SPEED_FILTER_VERSION = 'phone-speed-v1';
type Snapshot = { through: number; bytes: number; dropped: number; limitBytes: number };
export type DiagnosticBridge = {
  configure(enabled: boolean, session: string | null, expires: number, metadata: string): Promise<void>;
  append(session: string, entries: string): Promise<void>;
  snapshot(session: string): Promise<Snapshot>;
  read(session: string, after: number, through: number): Promise<{seq: number; body: string}[]>;
  delete(session: string): Promise<void>;
};
export const tripDiagnosticBridge = () => Platform.OS === 'web' ? null : requireOptionalNativeModule<DiagnosticBridge>('VeetrTripDiagnostics');
let enabled = false, active: string | null = null, revision = 0;
let tail: Promise<unknown> = Promise.resolve();
const exclusive = <T,>(work: () => Promise<T>) => { const result = tail.then(work); tail = result.catch(() => {}); return result; };
let configured: string | undefined;
export function configureTripDiagnostics(optIn: boolean, session: TrackingSession | null): Promise<void> {
  const id = session?.phase === 'recording' ? session.id : null;
  const key = `${optIn}:${id}:${session?.expiresAt ?? ''}`;
  if (!optIn) { enabled = false; active = null; revision++; }
  return exclusive(async () => {
    if (key === configured) return;
    const bridge = tripDiagnosticBridge();
    await bridge?.configure(optIn,id,session ? Date.parse(session.expiresAt) : 0,JSON.stringify({
      schemaVersion: DIAGNOSTIC_SCHEMA, filterVersion: SPEED_FILTER_VERSION,
      appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null,
      build: Application.nativeBuildVersion ?? null, platform: Platform.OS,
      osVersion: Device.osVersion ?? String(Platform.Version), model: Device.modelName ?? null,
      clock: 'atMs: Unix milliseconds; monotonicMs: platform uptime milliseconds',
      speedUnit: 'm/s', instrumentSpeedUnit: 'knots', angleUnit: 'degrees',
      recordingExpiresAt: session?.expiresAt ?? null, sensorRateHz: 5, estimation: 'none',
    }));
    configured = key; enabled = optIn && !!bridge; active = id;
  });
}
export function recordTripDiagnostic(id: string, build: () => Record<string, unknown>): void {
  if (!enabled || active !== id) return;
  const generation = revision;
  void exclusive(async () => {
    if (!enabled || active !== id || generation !== revision) return;
    await tripDiagnosticBridge()?.append(id,JSON.stringify([build()]));
  }).catch(() => {}); // Diagnostic failure must never interrupt GPS capture.
}
export function tripDiagnosticEvent(event: string, details: Record<string, unknown> = {}) {
  if (active) recordTripDiagnostic(active, () => ({type:'event', event, atMs:Date.now(), appState:AppState.currentState, ...details}));
}
export function diagnosticFix(raw: LocationFix, filtered: TrackingPoint | null, recorded: TrackingPoint | null, motion: MotionState, via: string, receivedAtMs: number) {
  const c = raw.coords;
  return {
    type:'gps', atMs:raw.timestamp, receivedAtMs, deliveryDelayMs:receivedAtMs-raw.timestamp, via,
    raw: { ...raw, coords: { ...c, speedAccuracy:c.speedAccuracy ?? null, headingAccuracy:c.headingAccuracy ?? null } },
    filtered, recorded, motion, filterVersion:SPEED_FILTER_VERSION, estimated:false, confidence:null,
    reason: !filtered ? 'rejected_fix' : filtered.sogMps === null ? (c.accuracy !== null && c.accuracy > 25 ? 'poor_accuracy' : 'speed_unavailable') :
      filtered.sogMps === 0 && (c.speed ?? 0) > 0 ? 'low_speed_noise' : 'accepted',
  };
}
export async function flushTripDiagnostics() { await tail; }
export async function deleteTripDiagnostics(id: string) {
  await exclusive(async () => { await tripDiagnosticBridge()?.delete(id); });
}
