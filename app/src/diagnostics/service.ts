import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { trackingStore } from '../tracking/database';
import { ageSeconds, diagnosticErrorCode, emptyState, enqueue, type DiagnosticEvent, type QueueState } from './queue';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const apiKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const storageKey = `veetr-diagnostics-v1:${url ?? 'unconfigured'}`;
let tail: Promise<unknown> = Promise.resolve();
const exclusive = <T,>(work: () => Promise<T>): Promise<T> => {
  const result = tail.then(work); tail = result.catch(() => {}); return result;
};
async function read(): Promise<QueueState> {
  try {
    const data = JSON.parse(await AsyncStorage.getItem(storageKey) ?? 'null');
    if (data && typeof data.enabled === 'boolean' && Array.isArray(data.events)) return data;
  } catch { /* A missing/corrupt preference must never opt a user in. */ }
  return emptyState();
}
const save = (state: QueueState) => AsyncStorage.setItem(storageKey, JSON.stringify(state));
let revision = 0;
let controller: AbortController | null = null;
let uploading: Promise<void> | null = null;
let lastUploadAttempt = 0;
let lastHealth = 0;
export const diagnosticsEnabled = () => exclusive(async () => (await read()).enabled);
export const diagnosticIdentity = () => exclusive(async () => (await read()).installationId);
export async function setDiagnosticsEnabled(enabled: boolean) {
  // Invalidate in-progress collection immediately, even before disk I/O completes.
  revision++;
  if (!enabled) controller?.abort();
  await exclusive(async () => {
    const state = await read();
    await save(enabled ? { ...state, enabled: true, installationId: state.installationId ?? Crypto.randomUUID() } : emptyState());
  });
  if (enabled) reportDiagnostic('health');
}

async function snapshot(event: DiagnosticEvent['event'], consent: DiagnosticEvent['consent'], installationId: string, error?: unknown): Promise<DiagnosticEvent> {
  const now = Date.now();
  const store = await trackingStore();
  const [session, pendingCount, foreground, background] = await Promise.all([
    store.get(), store.count(), Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync(),
  ]);
  const short = (value: unknown) => String(value ?? 'unknown').slice(0, 80);
  return {
    id: Crypto.randomUUID(), installationId, occurredAt: new Date(now).toISOString(), consent, event,
    appVersion: short(Application.nativeApplicationVersion ?? Constants.expoConfig?.version),
    build: short(Application.nativeBuildVersion),
    platform: Platform.OS, osVersion: short(Device.osVersion ?? Platform.Version),
    // Hardware model only, never deviceName (which can contain the owner's name).
    model: short(Device.modelName),
    state: ['active', 'background', 'inactive'].includes(AppState.currentState) ? AppState.currentState : 'unknown',
    foregroundPermission: foreground.status, backgroundPermission: background.status,
    tracking: session?.phase ?? 'none', fixAgeSeconds: ageSeconds(session?.lastRecordedAt, now),
    uploadAgeSeconds: ageSeconds(session?.lastUploadAt, now),
    accuracyM: session?.lastReportedAccuracyM != null && Number.isFinite(session.lastReportedAccuracyM) ? Math.max(0, Math.min(session.lastReportedAccuracyM, 100000)) : null,
    pendingCount, recoveryCount: session?.gpsRecoveryCount ?? 0,
    errorCode: diagnosticErrorCode(error ?? session?.lastTaskError ?? session?.error),
  };
}
async function collect(event: DiagnosticEvent['event'], manual: boolean, error?: unknown): Promise<string | null> {
  const generation = revision;
  const state = await exclusive(read);
  if (!manual && !state.enabled) return null;
  if (!manual && event === 'health' && Date.now() - lastHealth < 60000) return null;
  if (!manual && event === 'health') lastHealth = Date.now();
  const item = await snapshot(event, manual ? 'manual' : 'automatic', manual ? Crypto.randomUUID() : state.installationId!, error);
  return exclusive(async () => {
    if (generation !== revision) return null;
    const current = await read();
    if (!manual && !current.enabled) return null;
    await save(enqueue(current, item, Date.now()));
    return item.id;
  });
}
export function reportDiagnostic(event: DiagnosticEvent['event'], error?: unknown): void {
  // Never await telemetry from recording, recovery or upload paths.
  void collect(event, false, error).then(() => flushDiagnostics()).catch(() => {});
}
export async function sendDiagnosticReport(): Promise<string> {
  const generation = revision;
  const id = await collect('manual', true);
  if (!id) throw new Error('Report cancelled. Please try again.');
  await flushDiagnostics(true).catch(() => {});
  if (generation !== revision) return 'Reporting preference changed. Unsent reports were cancelled.';
  const queued = await exclusive(async () => (await read()).events.some(e => e.id === id));
  return `${queued ? 'Report saved; it will send when connected.' : 'Report sent.'} Report ID: ${id}`;
}
export function flushDiagnostics(force = false): Promise<void> {
  if (uploading) return uploading;
  if (!force && Date.now() - lastUploadAttempt < 60000) return Promise.resolve();
  lastUploadAttempt = Date.now();
  uploading = (async () => {
    if (!url || !apiKey) throw new Error('Diagnostics unavailable in this build.');
    const generation = revision;
    const events = await exclusive(async () => {
      const state = await read();
      state.events = state.events.filter(e => Date.now() - Date.parse(e.occurredAt) < 7 * 86400000 && (e.consent === 'manual' || state.enabled));
      await save(state); return state.events.slice(0, 20);
    });
    if (!events.length || generation !== revision) return;
    controller = new AbortController();
    const timer = setTimeout(() => controller?.abort(), 8000);
    try {
      // Separate anonymous request: do not attach account JWTs or race/session IDs.
      const response = await fetch(`${url}/rest/v1/rpc/submit_diagnostics`, {
        method: 'POST', headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: events }), signal: controller.signal,
      });
      if (!response.ok) throw new Error('Diagnostic upload failed.');
      const ids = new Set(events.map(e => e.id));
      await exclusive(async () => {
        const state = await read(); state.events = state.events.filter(e => !ids.has(e.id)); await save(state);
      });
    } finally { clearTimeout(timer); controller = null; }
  })().finally(() => { uploading = null; });
  return uploading;
}
