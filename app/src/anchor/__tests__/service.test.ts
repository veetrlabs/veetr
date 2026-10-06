const mockStorage = { getItem: jest.fn(), setItem: jest.fn() };
const mockLocation = {
  requestForegroundPermissionsAsync: jest.fn(), requestBackgroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(), hasStartedLocationUpdatesAsync: jest.fn(), stopLocationUpdatesAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6 }, ActivityType: { OtherNavigation: 4 },
};
const mockNotifications = { cleanupAlarmActivities: jest.fn(), checkAlarmReadiness: jest.fn(), clearNotifications: jest.fn(), notifyAlarm: jest.fn(), prepareNotifications: jest.fn(), scheduleWatchdog: jest.fn() };
const mockTasks = { isTaskDefined: jest.fn(() => false), defineTask: jest.fn() };
jest.mock('@react-native-async-storage/async-storage', () => mockStorage);
jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { currentState: 'active' } }));
jest.mock('expo-location', () => mockLocation);
jest.mock('expo-task-manager', () => mockTasks);
jest.mock('../notifications', () => mockNotifications);
jest.mock('../../i18n', () => ({ t: (value: string) => value }));
let service: typeof import('../service');
const anchor = { latitude: 43, longitude: 16 };
let now = 1000000;
const fix = (latitude = 43) => ({ ...anchor, latitude, timestamp: now, accuracy: 5, source: 'phone' as const });
beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks(); now = 1000000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined);
  mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
  mockLocation.startLocationUpdatesAsync.mockResolvedValue(undefined);
  mockNotifications.prepareNotifications.mockResolvedValue(undefined);
  service = require('../service');
});
afterEach(() => jest.restoreAllMocks());
async function arm() {
  await service.editAnchor({ anchor }); await service.receiveAnchorFix(fix()); await service.armAnchor();
}
it('requires anchor, reliable fix and background permission', async () => {
  await expect(service.armAnchor()).rejects.toThrow('position first');
  await service.editAnchor({ anchor });
  await expect(service.armAnchor()).rejects.toThrow('reliable GPS');
  await service.receiveAnchorFix(fix());
  mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await expect(service.armAnchor()).rejects.toThrow('background location');
  expect(service.getAnchorSnapshot().settings.armed).toBe(false);
  expect(mockLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
});
it('latches breach, repeats after 30 seconds and stops only its own task', async () => {
  await arm(); now += 1000; await service.receiveAnchorFix(fix(43.001));
  expect(service.getAnchorSnapshot().settings.alarm).toBe(true);
  expect(mockNotifications.notifyAlarm).toHaveBeenCalledTimes(1);
  now += 1000; await service.receiveAnchorFix(fix());
  expect(service.getAnchorSnapshot().settings.alarm).toBe(true);
  expect(mockNotifications.notifyAlarm).toHaveBeenCalledTimes(1);
  now += 30000; await service.receiveAnchorFix(fix());
  expect(mockNotifications.notifyAlarm).toHaveBeenCalledTimes(2);
  await service.stopAnchor();
  expect(mockLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith(service.ANCHOR_TASK);
  expect(mockNotifications.clearNotifications).toHaveBeenCalled();
  expect(service.getAnchorSnapshot().settings).toMatchObject({ armed: false, alarm: false, chainM: 30, anchor });
});
it('does not postpone loss-of-position warning for stale fixes', async () => {
  await arm(); mockNotifications.scheduleWatchdog.mockClear();
  now += 31000; await service.tickAnchor();
  expect(service.getAnchorSnapshot().fix).toBeNull();
  expect(mockNotifications.scheduleWatchdog).not.toHaveBeenCalled();
});
it('rolls back arming when native startup fails', async () => {
  await service.editAnchor({ anchor }); await service.receiveAnchorFix(fix());
  mockLocation.startLocationUpdatesAsync.mockRejectedValueOnce(new Error('native start failed'));
  await expect(service.armAnchor()).rejects.toThrow('native start failed');
  expect(service.getAnchorSnapshot().settings.armed).toBe(false);
  expect(mockNotifications.clearNotifications).toHaveBeenCalled();
});
it('persists valid edits and immediately evaluates a reduced radius', async () => {
  await arm(); await service.editAnchor({ chainM: 70, marginM: 20 });
  now += 1000; await service.receiveAnchorFix(fix(43.0005));
  expect(service.getAnchorSnapshot().settings.alarm).toBe(false);
  await service.editAnchor({ chainM: 20, marginM: 10 });
  expect(service.getAnchorSnapshot().settings.alarm).toBe(true);
  await expect(service.editAnchor({ chainM: NaN })).rejects.toThrow();
  expect(service.getAnchorSnapshot().settings.chainM).toBe(20);
});
it('resumes persisted monitoring without mounting settings', async () => {
  mockStorage.getItem.mockResolvedValue(JSON.stringify({ anchor, chainM: 60, marginM: 20, armed: true, alarm: true }));
  await service.resumeAnchor();
  expect(service.getAnchorSnapshot().settings.chainM).toBe(60);
  expect(mockLocation.startLocationUpdatesAsync).toHaveBeenCalledWith(service.ANCHOR_TASK, expect.any(Object));
  expect(mockNotifications.notifyAlarm).toHaveBeenCalled();
  expect(mockNotifications.scheduleWatchdog).not.toHaveBeenCalled();
});
it('evaluates native background fixes without React', async () => {
  await arm(); const task = mockTasks.defineTask.mock.calls[0][1]; now += 1000;
  await task({ data: { locations: [{ coords: { ...anchor, latitude: 43.001, accuracy: 5 }, timestamp: now }] } });
  expect(mockNotifications.notifyAlarm).toHaveBeenCalledTimes(1);
});
it('serializes stop against incoming callbacks', async () => {
  await arm(); now += 1000;
  await Promise.all([service.stopAnchor(), service.receiveAnchorFix(fix(43.001))]);
  expect(service.getAnchorSnapshot().settings.armed).toBe(false);
  expect(mockNotifications.notifyAlarm).not.toHaveBeenCalled();
});
it('does not refresh the native watchdog during a latched drag alarm', async () => {
  await arm(); mockNotifications.scheduleWatchdog.mockClear(); now += 21000;
  await service.receiveAnchorFix(fix(43.001));
  expect(mockNotifications.notifyAlarm).toHaveBeenCalledWith(false, 'system');
  expect(mockNotifications.scheduleWatchdog).not.toHaveBeenCalled();
});
it('clears the native latch when explicitly changing an armed area', async () => {
  await arm(); mockNotifications.clearNotifications.mockClear();
  await service.editAnchor({ chainM: 70, sound: 'siren' });
  expect(mockNotifications.clearNotifications).toHaveBeenCalledTimes(1);
  expect(mockNotifications.scheduleWatchdog).toHaveBeenLastCalledWith(now, 'siren');
});
it('refuses to arm when native alarm permission is denied', async () => {
  await service.editAnchor({ anchor }); await service.receiveAnchorFix(fix());
  mockNotifications.prepareNotifications.mockRejectedValueOnce(new Error('Allow Alarms'));
  await expect(service.armAnchor()).rejects.toThrow('Allow Alarms');
  expect(service.getAnchorSnapshot().settings.armed).toBe(false);
});

it('cleans orphaned alarm activities on resume without canceling a pending test', async () => {
  await service.resumeAnchor();
  expect(mockNotifications.cleanupAlarmActivities).toHaveBeenCalledTimes(1);
  expect(mockNotifications.clearNotifications).not.toHaveBeenCalled();
  expect(service.getAnchorSnapshot().settings.armed).toBe(false);
});

it('autosaved radius changes preserve an already triggered alarm and its sound', async () => {
  await arm();
  now += 1000; await service.receiveAnchorFix(fix(43.001));
  expect(service.getAnchorSnapshot().settings.alarm).toBe(true);
  mockNotifications.clearNotifications.mockClear();
  await service.editAnchor({ chainM: 200 });
  expect(service.getAnchorSnapshot().settings.chainM).toBe(200);
  expect(service.getAnchorSnapshot().settings.alarm).toBe(true);
  expect(mockNotifications.clearNotifications).not.toHaveBeenCalled();
});
