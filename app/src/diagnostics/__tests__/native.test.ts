jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
const mockSnapshot = jest.fn();
const mockConsent = jest.fn();
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => ({ getVeetrDiagnostics: mockSnapshot, setVeetrDiagnosticsEnabled: mockConsent }) }));
import { nativeDiagnostics, setNativeDiagnosticsEnabled } from '../native';

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
