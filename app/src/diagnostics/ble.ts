// In-memory technical breadcrumbs only. Never retain peripheral IDs, names,
// characteristic values, raw errors or sensor readings.
export const bleStages = ['adapter', 'permission', 'scan', 'connect', 'discover', 'mtu', 'services', 'characteristics', 'subscribe', 'connected', 'disconnect', 'reconnect', 'cleanup'] as const;
export type BleStage = typeof bleStages[number];
export type BleOutcome = 'start' | 'success' | 'error' | 'requested';
const adapterStates = ['Unknown', 'Resetting', 'Unsupported', 'Unauthorized', 'PoweredOff', 'PoweredOn'] as const;
type Entry = { stage: BleStage; outcome: BleOutcome; adapterState: string; errorCode: number | null; iosErrorCode: number | null; androidErrorCode: number | null; attErrorCode: number | null; at: number };
let adapterState: string = 'Unknown';
let entries: Entry[] = [];
const code = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100000 ? value : null;
export function setBleAdapterState(value: unknown) {
  adapterState = adapterStates.includes(value as any) ? value as string : 'Unknown';
}
export function recordBleDiagnostic(stage: BleStage, outcome: BleOutcome, error?: unknown) {
  const raw = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  entries = [...entries, { stage, outcome, adapterState, errorCode: code(raw.errorCode), iosErrorCode: code(raw.iosErrorCode), androidErrorCode: code(raw.androidErrorCode), attErrorCode: code(raw.attErrorCode), at: Date.now() }].slice(-20);
}
export function bleDiagnostics() {
  const now = Date.now();
  return entries.filter(entry => now - entry.at <= 30 * 60 * 1000).map(({ at, ...entry }) => ({ ...entry, ageSeconds: Math.max(0, Math.round((now - at) / 1000)) }));
}
export function clearBleDiagnostics() { entries = []; adapterState = 'Unknown'; }
