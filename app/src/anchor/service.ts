import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { t } from '../i18n';
import { AnchorFix, AnchorState, chooseFix, defaults, distanceM, radiusM, restoreState, validateSettings } from './model';
import { checkAlarmReadiness, clearNotifications, notifyAlarm, prepareNotifications, scheduleWatchdog } from './notifications';
export const ANCHOR_TASK = 'veetr-anchor-location-v1';
const KEY = '@veetr_anchor_v1';
type Snapshot = { settings: AnchorState; fix: AnchorFix | null; error: string; ready: boolean };
let snapshot: Snapshot = { settings: { ...defaults }, fix: null, error: '', ready: false };
let phone: AnchorFix | null = null, vane: AnchorFix | null = null;
let watchdogAt = 0, alarmAt = 0;
let loading: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
export const getAnchorSnapshot = () => snapshot;
export function subscribeAnchor(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function publish(patch: Partial<Snapshot>) { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn()); }
export function anchorError(error: unknown) { publish({ error: error instanceof Error ? error.message : String(error) }); }
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn); queue = next.catch(() => {}); return next;
}
export function loadAnchor() {
  return loading ??= AsyncStorage.getItem(KEY).then(raw => { publish({ settings: restoreState(raw), ready: true }); });
}
async function save(settings: AnchorState) {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  publish({ settings });
}
export function editAnchor(patch: Partial<Pick<AnchorState, 'anchor' | 'chainM' | 'marginM' | 'sound'>>) {
  return serial(async () => {
    await loadAnchor();
    const settings = { ...snapshot.settings, ...patch, alarm: false };
    validateSettings(settings);
    if (settings.armed) {
      if (!chooseFix(phone, vane, Date.now())) throw new Error('Wait for a reliable GPS position before starting.');
      await checkAlarmReadiness();
    }
    await save(settings);
    if (settings.armed) await clearNotifications();
    watchdogAt = 0; alarmAt = 0;
    await evaluate();
  });
}
async function evaluate() {
  const now = Date.now(), fix = chooseFix(phone, vane, now);
  publish({ fix });
  const s = snapshot.settings;
  if (!s.armed) return;
  await checkAlarmReadiness();
  if (fix) {
    if (s.anchor && distanceM(s.anchor, fix) > radiusM(s) && !s.alarm) await save({ ...s, alarm: true });
  }
  if (snapshot.settings.alarm && now - alarmAt >= 30000) {
    await notifyAlarm(false, snapshot.settings.sound); alarmAt = now;
  }
  if (!snapshot.settings.alarm && fix && now - watchdogAt > 20000) {
    await scheduleWatchdog(fix.timestamp, s.sound); watchdogAt = now;
  }
}
export function receiveAnchorFix(fix: AnchorFix) {
  return serial(async () => {
    await loadAnchor();
    const previous = fix.source === 'vane' ? vane : phone;
    if (!previous || fix.timestamp > previous.timestamp) {
      if (fix.source === 'vane') vane = fix; else phone = fix;
    }
    await evaluate();
  });
}
export function tickAnchor() { return serial(async () => { await loadAnchor(); await evaluate(); }); }
async function startLocation() {
  if (AppState.currentState !== 'active') throw new Error('Keep Veetr open while starting the anchor alarm.');
  await Location.startLocationUpdatesAsync(ANCHOR_TASK, {
    accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 0,
    deferredUpdatesInterval: 0, pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.OtherNavigation, showsBackgroundLocationIndicator: true,
    foregroundService: { notificationTitle: t('Anchor alarm active'),
      notificationBody: t('Monitoring your anchor. Open Veetr to stop.'), killServiceOnDestroy: false },
  });
  if (!(await Location.hasStartedLocationUpdatesAsync(ANCHOR_TASK))) throw new Error('Background anchor monitoring did not start.');
}
export function armAnchor() {
  return serial(async () => {
    await loadAnchor();
    validateSettings(snapshot.settings);
    if (!snapshot.settings.anchor) throw new Error('Set the anchor position first.');
    if (!chooseFix(phone, vane, Date.now())) throw new Error('Wait for a reliable GPS position before starting.');
    await prepareNotifications();
    if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted' ||
      (await Location.requestBackgroundPermissionsAsync()).status !== 'granted')
      throw new Error('Allow precise location and background location in system settings to monitor your anchor.');
    const initialFix = chooseFix(phone, vane, Date.now());
    if (!initialFix) throw new Error('Wait for a reliable GPS position before starting.');
    try {
      await clearNotifications();
      await save({ ...snapshot.settings, armed: true, alarm: false });
      await startLocation();
      await scheduleWatchdog(initialFix.timestamp, snapshot.settings.sound); watchdogAt = Date.now(); alarmAt = 0;
      publish({ error: '' });
      await evaluate();
    } catch (error) {
      await save({ ...snapshot.settings, armed: false, alarm: false });
      await stopLocation();
      await clearNotifications();
      throw error;
    }
  });
}
async function stopLocation() {
  if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(ANCHOR_TASK))
    await Location.stopLocationUpdatesAsync(ANCHOR_TASK);
}
export function stopAnchor() {
  return serial(async () => {
    await loadAnchor();
    await clearNotifications();
    await save({ ...snapshot.settings, armed: false, alarm: false });
    await stopLocation();
    publish({ error: '' });
  });
}
export function resumeAnchor() {
  return serial(async () => {
    await loadAnchor();
    if (snapshot.settings.armed) {
      await checkAlarmReadiness();
      // Do not renew the watchdog until an actual fresh position arrives.
      await startLocation();
      await evaluate();
    } else await stopLocation();
  });
}
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(ANCHOR_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(ANCHOR_TASK, async ({ data, error }) => {
    if (error) { anchorError(error.message); return; }
    for (const location of data?.locations ?? []) {
      await receiveAnchorFix({ latitude: location.coords.latitude, longitude: location.coords.longitude,
        accuracy: location.coords.accuracy, timestamp: location.timestamp, source: 'phone' });
    }
  });
}
