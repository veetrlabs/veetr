const mockNative = { cleanupActivities: jest.fn(), testState: jest.fn().mockResolvedValue('idle'), prepare: jest.fn(), check: jest.fn(), trigger: jest.fn(), watchdog: jest.fn(), stop: jest.fn(), stopTest: jest.fn(), openSettings: jest.fn() };
const mockModule = jest.fn(() => mockNative);
const mockNotifications = { requestPermissionsAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(), dismissNotificationAsync: jest.fn() };
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => mockModule() }));
jest.mock('expo-notifications/build/NotificationPermissions', () => ({ requestPermissionsAsync: (...a: unknown[]) => mockNotifications.requestPermissionsAsync(...a) }));
jest.mock('expo-notifications/build/cancelScheduledNotificationAsync', () => (...a: unknown[]) => mockNotifications.cancelScheduledNotificationAsync(...a));
jest.mock('expo-notifications/build/dismissNotificationAsync', () => (...a: unknown[]) => mockNotifications.dismissNotificationAsync(...a));
jest.mock('expo-notifications/build/setNotificationChannelAsync', () => jest.fn());
jest.mock('expo-notifications/build/NotificationChannelManager.types', () => ({ AndroidImportance: { HIGH: 4 }, AndroidNotificationVisibility: { PUBLIC: 1 } }));
jest.mock('../../i18n', () => ({ t: (s: string) => s }));
const { cleanupAlarmActivities, getAlarmTestState, clearNotifications, notifyAlarm, prepareNotifications, scheduleWatchdog, stopAlarmTest } = require('../notifications') as typeof import('../notifications');
beforeEach(() => { jest.clearAllMocks(); mockModule.mockReturnValue(mockNative); });
it('uses AlarmKit permission instead of ordinary iOS notification permission', async () => {
  await prepareNotifications();
  expect(mockNative.prepare).toHaveBeenCalled();
  expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
it('passes the selected sound and isolates tests from live alarms', async () => {
  await notifyAlarm(true, 'siren');
  expect(mockNative.trigger).toHaveBeenCalledWith('Anchor alarm test', 'siren', true);
  await stopAlarmTest();
  expect(mockNative.stopTest).toHaveBeenCalled();
  expect(mockNative.stop).not.toHaveBeenCalled();
});
it('uses the actual fix timestamp for the native GPS-loss deadline', async () => {
  await scheduleWatchdog(10000, 'system');
  expect(mockNative.watchdog).toHaveBeenCalledWith(expect.any(String), 'system', 100000);
});
it('clears native alarms and legacy scheduled notifications', async () => {
  await clearNotifications();
  expect(mockNative.stop).toHaveBeenCalled();
  expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('veetr-anchor-no-position');
});
it('does not silently fall back to a notification when the native module is missing', async () => {
  mockModule.mockReturnValue(null as never);
  await expect(prepareNotifications()).rejects.toThrow('native Veetr build');
});

it('reports the native test state and supports older installed modules', async () => {
  mockNative.testState.mockResolvedValueOnce('alerting');
  await expect(getAlarmTestState()).resolves.toBe('alerting');
  mockModule.mockReturnValue({ ...mockNative, testState: undefined } as never);
  await expect(getAlarmTestState()).resolves.toBe('unknown');
});

it('cleans orphaned iOS activities without stopping active alarms or tests', async () => {
  await cleanupAlarmActivities();
  expect(mockNative.cleanupActivities).toHaveBeenCalledTimes(1);
  expect(mockNative.stop).not.toHaveBeenCalled();
  expect(mockNative.stopTest).not.toHaveBeenCalled();
  mockModule.mockReturnValue(null as never);
  await expect(cleanupAlarmActivities()).resolves.toBeUndefined();
});
