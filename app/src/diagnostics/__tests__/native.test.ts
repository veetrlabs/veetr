jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
const mockSnapshot = jest.fn();
const mockHistory = jest.fn();
const mockMarker = jest.fn();
const mockConsent = jest.fn();
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => ({ getVeetrDiagnostics: mockSnapshot, getVeetrTrackingHistory: mockHistory, recordVeetrDiagnostic: mockMarker, setVeetrDiagnosticsEnabled: mockConsent }) }));
import { nativeDiagnostics, setNativeDiagnosticsEnabled, trackingHistory, markTrackingDiagnostic } from '../native';

test('native reports allow only bounded technical counters and flags', async () => {
  mockSnapshot.mockResolvedValue({ fixCount: 12, fixScreenOffCount: 4, lastFixDelayMs: Infinity, serviceRunning: true, latitude: 49, userId: 'secret', rawError: 'secret-token' });
  const result = await nativeDiagnostics();
  expect(result).toMatchObject({ fixCount: 12, fixScreenOffCount: 4, lastFixDelayMs: null, serviceRunning: true });
  expect(JSON.stringify(result)).not.toMatch(/latitude|userId|rawError|secret/);
});
test('a native diagnostics failure does not break report collection', async () => {
  mockSnapshot.mockRejectedValue(new Error('Native unavailable'));
  expect(await nativeDiagnostics()).toBeNull();
});
test('consent reaches the native recorder for enabling and deletion', async () => {
  await setNativeDiagnosticsEnabled(true);
  await setNativeDiagnosticsEnabled(false);
  expect(mockConsent.mock.calls).toEqual([[true], [false]]);
});

test('history strips unexpected fields and rejects unknown or expired events', async () => {
  mockHistory.mockResolvedValue([
    {event:'gap',ageSeconds:21758,fixes:441,callbacks:441,saved:440,latitude:49,rawError:'secret',reason:Infinity,screenOff:true},
    {event:'secret',ageSeconds:1},{event:'gap',ageSeconds:604801},{event:'gap',ageSeconds:-1},
  ]);
  const result = await trackingHistory();
  expect(result).toEqual([{event:'gap',ageSeconds:21758,fixes:441,callbacks:441,saved:440,taskStarts:null,savedAgeSeconds:null,reason:null,screenOff:true,quotaBlocked:null}]);
});
test('history is bounded and bridge errors do not interrupt recording', async () => {
  mockHistory.mockResolvedValue(Array(200).fill({event:'checkpoint',ageSeconds:3}));
  expect(await trackingHistory()).toHaveLength(64);
  mockHistory.mockRejectedValue(new Error('unsupported'));
  expect(await trackingHistory()).toEqual([]);
  mockMarker.mockRejectedValue(new Error('unsupported'));
  await expect(markTrackingDiagnostic('recovery')).resolves.toBeUndefined();
});
