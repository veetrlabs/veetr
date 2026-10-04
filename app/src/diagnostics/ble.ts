import { AppState } from 'react-native';
// In-memory technical breadcrumbs only. Never retain peripheral IDs, names,
// characteristic values, raw errors or sensor readings.
export const bleStages = ['adapter', 'permission', 'scan', 'connect', 'discover', 'mtu', 'services', 'characteristics', 'subscribe', 'connected', 'disconnect', 'reconnect', 'cleanup'] as const;
export type BleStage = typeof bleStages[number];
export type BleOutcome = 'start' | 'success' | 'error' | 'requested';
const adapterStates = ['Unknown', 'Resetting', 'Unsupported', 'Unauthorized', 'PoweredOff', 'PoweredOn'] as const;
type Entry = { stage: BleStage; outcome: BleOutcome; adapterState: string; errorCode: number | null; iosErrorCode: number | null; androidErrorCode: number | null; attErrorCode: number | null; at: number; sequence: number; appState: string; connectionSeconds: number | null; sensorAgeSeconds: number | null; rssi: number | null; rssiAgeSeconds: number | null; firmwareVersion: string | null; retryAttempt: number; method: string; attemptSeconds: number | null };
let adapterState: string = 'Unknown';
let entries: Entry[] = [];
let failures: Entry[] = [];
let sequence = 0;
let connectedAt: number | null = null, sensorAt: number | null = null, rssiAt: number | null = null, attemptAt: number | null = null;
let rssi: number | null = null, firmwareVersion: string | null = null, retryAttempt = 0, method = 'scan';
const age = (at: number | null) => at === null ? null : Math.max(0, Math.min(21600, Math.round((Date.now() - at) / 1000)));
export function beginBleAttempt(attempt: number, via: 'direct' | 'scan') { retryAttempt = Math.min(100000, Math.max(0, attempt)); method = via; attemptAt = Date.now(); }
export function noteBleConnected() { connectedAt = Date.now(); sensorAt = null; rssiAt = null; rssi = null; firmwareVersion = null; }
export function noteBleDisconnected() { connectedAt = null; sensorAt = null; rssiAt = null; rssi = null; }
export function noteBleSensor() { sensorAt = Date.now(); }
export function noteBleRssi(value: unknown) { if (typeof value === 'number' && Number.isInteger(value) && value >= -127 && value <= 0) { rssi = value; rssiAt = Date.now(); } }
export function noteBleFirmware(value: unknown) { firmwareVersion = typeof value === 'string' && /^v?\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[A-Za-z0-9.-]{1,24})?$/.test(value) ? value : null; }

const code = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100000 ? value : null;
export function setBleAdapterState(value: unknown) {
  adapterState = adapterStates.includes(value as any) ? value as string : 'Unknown';
}
export function recordBleDiagnostic(stage: BleStage, outcome: BleOutcome, error?: unknown) {
  const raw = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const entry: Entry = { stage, outcome, adapterState, errorCode: code(raw.errorCode), iosErrorCode: code(raw.iosErrorCode), androidErrorCode: code(raw.androidErrorCode), attErrorCode: code(raw.attErrorCode), at: Date.now(), sequence: ++sequence, appState: ['active','background','inactive'].includes(AppState.currentState) ? AppState.currentState : 'unknown', connectionSeconds: age(connectedAt), sensorAgeSeconds: age(sensorAt), rssi, rssiAgeSeconds: age(rssiAt), firmwareVersion, retryAttempt, method, attemptSeconds: age(attemptAt) };
  entries = [...entries, entry].slice(-20);
  if (outcome === 'error' || stage === 'disconnect') failures = [...failures, entry].slice(-8);
}
export function bleDiagnostics() {
  const now = Date.now();
  const retained = failures.filter(entry => now - entry.at <= 6 * 60 * 60 * 1000);
  const recent = entries.filter(entry => !retained.includes(entry) && now - entry.at <= 6 * 60 * 60 * 1000).slice(-(20 - retained.length));
  return [...retained, ...recent].sort((a,b) => a.sequence-b.sequence).map(({ at, sequence: _sequence, ...entry }) => ({ ...entry, ageSeconds: Math.max(0, Math.round((now - at) / 1000)) }));
}
export function clearBleDiagnostics() { entries = []; failures = []; adapterState = 'Unknown'; noteBleDisconnected(); firmwareVersion = null; attemptAt = null; retryAttempt = 0; method = 'scan'; }
