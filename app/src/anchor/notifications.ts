import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { t } from '../i18n';
const CHANNEL = 'anchor-alarm';
const WATCHDOG = 'veetr-anchor-no-position';
const ALARM = 'veetr-anchor-drag';
if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});
export async function prepareNotifications() {
  if (Platform.OS === 'web') throw new Error('Anchor monitoring requires the mobile app.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: t('Anchor alarm'), importance: Notifications.AndroidImportance.MAX,
    sound: 'default', enableVibrate: true, vibrationPattern: [0, 1000, 500, 1000],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  const permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
  if (!permission.granted || permission.ios?.allowsSound === false)
    throw new Error('Allow notifications and sound in system settings before starting the anchor alarm.');
}
function content(body: string) {
  return { title: t('Anchor alarm'), body: t(body), sound: 'default',
    priority: Notifications.AndroidNotificationPriority.MAX, interruptionLevel: 'timeSensitive' as const,
    data: { anchorAlarm: true } };
}
export async function notifyAlarm(test = false) {
  await Notifications.scheduleNotificationAsync({ identifier: test ? 'veetr-anchor-test' : ALARM,
    content: content(test ? 'Anchor alarm test. Check that you can hear this notification.' : 'Boat outside the anchor radius. Check your anchor now.'),
    trigger: { channelId: CHANNEL },
  });
}
export async function scheduleWatchdog() {
  // A native scheduled notification still warns if JS/location delivery stops.
  await Notifications.scheduleNotificationAsync({ identifier: WATCHDOG,
    content: content('No reliable position received. Open Veetr and check your anchor.'),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 90, channelId: CHANNEL },
  });
}
export async function clearNotifications() {
  await Notifications.cancelScheduledNotificationAsync(WATCHDOG);
  await Notifications.dismissNotificationAsync(WATCHDOG);
  await Notifications.dismissNotificationAsync(ALARM);
}
