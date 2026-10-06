import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
// Import only local-notification APIs: the barrel starts unrelated push-token registration.
import { requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import setNotificationChannelAsync from 'expo-notifications/build/setNotificationChannelAsync';
import cancelScheduledNotificationAsync from 'expo-notifications/build/cancelScheduledNotificationAsync';
import dismissNotificationAsync from 'expo-notifications/build/dismissNotificationAsync';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications/build/NotificationChannelManager.types';
import { t } from '../i18n';
import { AnchorState } from './model';
export type AlarmTestState = 'idle' | 'scheduled' | 'alerting' | 'unknown';
type Sound = AnchorState['sound'];
type NativeAlarm = {
  cleanupActivities?(): Promise<void>;
  testState?(): Promise<AlarmTestState>;
  prepare(): Promise<void>; check(): Promise<void>;
  trigger(title: string, sound: Sound, test: boolean): Promise<void>;
  watchdog(title: string, sound: Sound, deadline: number): Promise<void>;
  stop(): Promise<void>; stopTest(): Promise<void>; openSettings(): Promise<void>;
};
function native() {
  const module = Platform.OS !== 'web' ? requireOptionalNativeModule<NativeAlarm>('VeetrAnchorAlarm') : null;
  if (!module) throw new Error('Install the latest native Veetr build to use loud anchor alarms.');
  return module;
}
export async function prepareNotifications() {
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync('veetr-native-anchor-alarm', {
      name: t('Anchor alarm'), importance: AndroidImportance.HIGH, sound: null,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    });
    const permission = await requestPermissionsAsync();
    if (!permission.granted) throw new Error('Allow notifications in system settings before starting the anchor alarm.');
  }
  await native().prepare();
}
export async function cleanupAlarmActivities() {
  if (Platform.OS === 'ios') {
    // Optional for older binaries; this must never cancel a pending sound test.
    await requireOptionalNativeModule<NativeAlarm>('VeetrAnchorAlarm')?.cleanupActivities?.();
  }
}
export const checkAlarmReadiness = () => native().check();
// Older installed binaries cannot report state; keep Stop available until explicitly stopped.
export const getAlarmTestState = async (): Promise<AlarmTestState> => native().testState?.() ?? 'unknown';
export const stopAlarmTest = () => native().stopTest();
export const openAlarmSettings = () => native().openSettings();
export async function notifyAlarm(test = false, sound: Sound = 'system') {
  await native().trigger(t(test ? 'Anchor alarm test' : 'Boat outside the anchor radius. Check your anchor now.'), sound, test);
}
export async function scheduleWatchdog(timestamp = Date.now(), sound: Sound = 'system') {
  await native().watchdog(t('No reliable position received. Open Veetr and check your anchor.'), sound, timestamp + 90000);
}
export async function clearNotifications() {
  await native().stop();
  // Remove notifications left by builds predating the native alarm.
  for (const id of ['veetr-anchor-no-position', 'veetr-anchor-drag', 'veetr-anchor-test']) {
    await cancelScheduledNotificationAsync(id);
    await dismissNotificationAsync(id);
  }
}
