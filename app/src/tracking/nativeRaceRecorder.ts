import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as SQLite from 'expo-sqlite';
import type { TrackingSession } from './model';
import { trackingStore } from './database';
import { racePhoneSecret } from './racePhone';

type Bridge = {
  startVeetrRaceRecorder?: (config: string) => Promise<void>;
  wakeVeetrRaceRecorder?: () => Promise<void>;
  stopVeetrRaceRecorder?: () => Promise<void>;
};
const bridge = () => Platform.OS === 'android' ? requireOptionalNativeModule<Bridge>('ExpoLocation') : null;
export const usesNativeRaceRecorder = (session: TrackingSession) => session.mode === 'race' && Number(Platform.Version) >= 26 && !!bridge()?.startVeetrRaceRecorder;
export async function startNativeRaceRecorder(session: TrackingSession) {
  if (!usesNativeRaceRecorder(session) || session.phase !== 'recording') return;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !session.raceLinkId) throw new Error('Race tracking is not configured.');
  const secret = await racePhoneSecret(session.raceLinkId);
  const requestedAt = Date.now();
  await bridge()!.startVeetrRaceRecorder!(JSON.stringify({
    sessionId: session.id, linkId: session.raceLinkId, secret, url, key,
    databasePath: `${SQLite.defaultDatabaseDirectory}/veetr-tracking.db`.replace(/^file:\/\//, ''),
  }));
  // Confirm the separate process actually registered GPS before displaying readiness.
  const store = await trackingStore();
  for (let attempt = 0; attempt < 40; attempt++) {
    const current = await store.get();
    if (current?.id !== session.id || current.phase !== 'recording') return;
    if (Date.parse(current.nativeRecorderStartedAt ?? '') >= requestedAt) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Background GPS did not start. Keep the app open and retry.');
}
export const wakeNativeRaceRecorder = async () => { await bridge()?.wakeVeetrRaceRecorder?.(); };
export const stopNativeRaceRecorder = async () => { await bridge()?.stopVeetrRaceRecorder?.(); };
