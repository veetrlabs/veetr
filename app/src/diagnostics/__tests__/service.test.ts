process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://diagnostics.example.test';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-key';
let mockStored: string | null = null;
let mockSerial = 0;
jest.mock('../native', () => ({ nativeDiagnostics: jest.fn(async () => null), setNativeDiagnosticsEnabled: jest.fn(async () => {}) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => mockStored), setItem: jest.fn(async (_key, value) => { mockStored = value; }) }));
jest.mock('react-native', () => ({ AppState: { currentState: 'active' }, Platform: { OS: 'android', Version: 34, constants: { Model: 'OnePlus' } } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '0.0.28' }, platform: { android: { versionCode: 12 } } } }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '0.0.28', nativeBuildVersion: '12' }));
jest.mock('expo-device', () => ({ modelName: 'OnePlus', osVersion: '14' }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockSerial}` }));
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })), getBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })) }));
jest.mock('../../tracking/database', () => ({ trackingStore: jest.fn(async () => ({
  get: async () => ({ id: 'SECRET-RACE-ID', userId: 'SECRET-USER', phase: 'recording', recentPoints: [{ latitude: 49, longitude: 14 }], error: 'network failed https://secret.test?token=SECRET', lastReportedAccuracyM: 8 }), count: async () => 3,
})) }));
const { diagnosticsEnabled, setDiagnosticsEnabled, reportDiagnostic, sendDiagnosticReport, flushDiagnostics }: typeof import('../service') = require('../service');
import { trackingStore } from '../../tracking/database';
import { AppState } from 'react-native';
import { setNativeDiagnosticsEnabled } from '../native';
import { diagnosticErrorCode, emptyState, enqueue, type DiagnosticEvent } from '../queue';
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise<void>(resolve => setImmediate(resolve)); };
beforeEach(async () => {
  await setDiagnosticsEnabled(false);
  mockStored = null; jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({ ok: true } as Response));
});
test('default off does not even gather a diagnostic snapshot', async () => {
  expect(await diagnosticsEnabled()).toBe(false);
  reportDiagnostic('gps_error', new Error('SECRET'));
  await settle();
  expect(trackingStore).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
test('manual report is one-off and excludes account, position and raw error text', async () => {
  const result = await sendDiagnosticReport();
  expect(result).toContain('Report sent.');
  expect(await diagnosticsEnabled()).toBe(false);
  const options = (fetch as jest.Mock).mock.calls[0][1];
  expect(options.headers.Authorization).toBe('Bearer public-key');
  expect(options.body).not.toMatch(/SECRET|latitude|longitude|userId|recentPoints|token/);
  const report = JSON.parse(options.body).reports[0];
  expect(report).toMatchObject({ consent: 'manual', errorCode: 'network', model: 'OnePlus', pendingCount: 3, accuracyM: 8 });
});
test('offline reports retry with identical IDs without silently enabling consent', async () => {
  (fetch as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  expect(await sendDiagnosticReport()).toContain('Report saved');
  const first = (fetch as jest.Mock).mock.calls[0][1].body;
  await flushDiagnostics(true);
  expect((fetch as jest.Mock).mock.calls[1][1].body).toBe(first);
  expect(JSON.parse(mockStored!).events).toEqual([]);
  expect(await diagnosticsEnabled()).toBe(false);
});
test('broken tracking storage still allows a diagnostic report without raw database errors', async () => {
  (trackingStore as jest.Mock).mockRejectedValueOnce(new Error('SECRET database failure'));
  expect(await sendDiagnosticReport()).toContain('Report sent.');
  const report = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).reports[0];
  expect(report.pipeline.storageAvailable).toBe(false);
  expect(JSON.stringify(report)).not.toContain('SECRET');
});
test('withdrawal clears queued events and the automatic identifier', async () => {
  await setDiagnosticsEnabled(true); await settle();
  (fetch as jest.Mock).mockRejectedValue(new Error('Offline'));
  await sendDiagnosticReport();
  await setDiagnosticsEnabled(false);
  expect(setNativeDiagnosticsEnabled).toHaveBeenLastCalledWith(false);
  expect(JSON.parse(mockStored!)).toEqual(emptyState());
  (fetch as jest.Mock).mockClear();
  await flushDiagnostics(true);
  expect(fetch).not.toHaveBeenCalled();
});

test('lifecycle reports preserve the triggering background state across async collection', async () => {
  await setDiagnosticsEnabled(true); await settle();
  expect(setNativeDiagnosticsEnabled).toHaveBeenCalledWith(true);
  (AppState as { currentState: string }).currentState = 'background';
  reportDiagnostic('app_state');
  (AppState as { currentState: string }).currentState = 'active';
  await settle();
  await flushDiagnostics(true);
  const reports = (fetch as jest.Mock).mock.calls.flatMap((call) => JSON.parse(call[1].body).reports);
  expect(reports).toContainEqual(expect.objectContaining({ event: 'app_state', state: 'background' }));
});
test('queue is bounded and expires old reports', () => {
  let state = { ...emptyState(), enabled: true };
  const now = Date.now();
  for (let i = 0; i < 110; i++) state = enqueue(state, { id: String(i), consent: 'automatic', occurredAt: new Date(now).toISOString() } as DiagnosticEvent, now);
  expect(state.events).toHaveLength(100);
  state = enqueue(state, { id: 'new', consent: 'manual', occurredAt: new Date(now + 8 * 86400000).toISOString() } as DiagnosticEvent, now + 8 * 86400000);
  expect(state.events.map(e => e.id)).toEqual(['new']);
  expect(diagnosticErrorCode('GPS failed for user@example.test')).toBe('gps');
});

test('withdrawal aborts in-flight sends and does not claim success after cancellation', async () => {
  let aborted = false;
  (fetch as jest.Mock).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }));
  const sending = sendDiagnosticReport();
  await settle();
  await setDiagnosticsEnabled(false);
  expect(await sending).toContain('cancelled');
  expect(aborted).toBe(true);
  expect(JSON.parse(mockStored!).events).toEqual([]);
});
