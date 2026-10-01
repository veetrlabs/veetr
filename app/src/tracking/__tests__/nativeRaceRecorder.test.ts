import { Platform } from 'react-native';
import { startNativeRaceRecorder, usesNativeRaceRecorder } from '../nativeRaceRecorder';
import { trackingStore } from '../database';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { TrackingSession } from '../model';
jest.mock('react-native', () => ({ Platform: { OS: 'android', Version: 36 } }));
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock('expo-sqlite', () => ({ defaultDatabaseDirectory: 'file:///data/app/files/SQLite' }));
jest.mock('../database', () => ({ trackingStore: jest.fn() }));
jest.mock('../racePhone', () => ({ racePhoneSecret: jest.fn(async () => 'test-device-secret') }));
const session = () => ({ id: 'race', mode: 'race', phase: 'recording', raceLinkId: 'link' } as TrackingSession);
beforeEach(() => { jest.clearAllMocks(); Platform.OS = 'android'; process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.invalid'; process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-key'; });
test('native start waits for actual GPS registration and uses the same persistent database', async () => {
  const current = session();
  const start = jest.fn(async (_config: string) => { current.nativeRecorderStartedAt = new Date().toISOString(); });
  (requireOptionalNativeModule as jest.Mock).mockReturnValue({ startVeetrRaceRecorder: start });
  (trackingStore as jest.Mock).mockResolvedValue({ get: async () => current });
  await startNativeRaceRecorder(current);
  expect(JSON.parse(start.mock.calls[0][0] as string)).toMatchObject({ sessionId: 'race', databasePath: '/data/app/files/SQLite/veetr-tracking.db', linkId: 'link' });
});
test('iOS and local trips retain their existing recording path', () => {
  (requireOptionalNativeModule as jest.Mock).mockReturnValue({ startVeetrRaceRecorder: jest.fn() });
  expect(usesNativeRaceRecorder({ ...session(), mode: 'local' })).toBe(false);
  Platform.OS = 'ios';
  expect(usesNativeRaceRecorder(session())).toBe(false);
});
test('older binaries without the bridge retain their existing recording path', () => {
  (requireOptionalNativeModule as jest.Mock).mockReturnValue(null);
  expect(usesNativeRaceRecorder(session())).toBe(false);
});
test('a pending server arm cannot start local capture', async () => {
  const start = jest.fn();
  (requireOptionalNativeModule as jest.Mock).mockReturnValue({ startVeetrRaceRecorder: start });
  await startNativeRaceRecorder({ ...session(), phase: 'starting' });
  expect(start).not.toHaveBeenCalled();
});
