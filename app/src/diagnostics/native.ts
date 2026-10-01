import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export const nativeStages = ['registered', 'requestAccepted', 'requestFailed', 'broadcast', 'fix', 'jobScheduled', 'jobStarted', 'taskDispatched', 'taskFinished', 'serviceStarted', 'serviceStopped'] as const;
export const nativeBooleans = ['enabled', 'serviceRunning', 'screenInteractive', 'powerSave', 'deviceIdle', 'batteryExempt', 'gpsProviderEnabled', 'networkProviderEnabled'] as const;
export const nativeNumbers = ['windowAgeSeconds', 'lastFixDelayMs', 'pendingJobs', 'quotaBlockedJobs', ...nativeStages.flatMap(stage => [`${stage}Count`, `${stage}ScreenOffCount`, `${stage}AgeSeconds`])];
export type NativeDiagnostics = Record<string, number | boolean | null>;
type Bridge = { setVeetrDiagnosticsEnabled?: (value: boolean) => Promise<void>; getVeetrDiagnostics?: () => Promise<unknown>; getVeetrTrackingHistory?: () => Promise<unknown>; recordVeetrDiagnostic?: (event: string, count: number) => Promise<void> };
const bridge = (): Bridge | null => Platform.OS === 'android' ? requireOptionalNativeModule<Bridge>('ExpoLocation') : null;
export async function setNativeDiagnosticsEnabled(value: boolean) {
  await bridge()?.setVeetrDiagnosticsEnabled?.(value);
}
export async function nativeDiagnostics(): Promise<NativeDiagnostics | null> {
  try {
    const raw = await bridge()?.getVeetrDiagnostics?.();
    if (!raw || typeof raw !== 'object') return null;
    const input = raw as Record<string, unknown>, result: NativeDiagnostics = {};
    // Only these technical fields can leave the native bridge, even after a library update.
    for (const key of nativeBooleans) result[key] = typeof input[key] === 'boolean' ? input[key] as boolean : null;
    for (const key of nativeNumbers) result[key] = typeof input[key] === 'number' && Number.isFinite(input[key]) ? Math.max(0, Math.min(10000000, input[key] as number)) : null;
    return result;
  } catch { return null; }
}

export const trackingHistoryEvents = ['checkpoint', 'gap', 'processStarted', 'processExit', 'registered', 'requestAccepted', 'requestFailed', 'serviceStarted', 'serviceStopped', 'serviceStopRequested', 'taskRemoved', 'jobStopped', 'jobPending', 'tripStarted', 'tripStopped', 'resume', 'recovery', 'storageFailed'] as const;
export type TrackingHistoryEntry = {
  event: typeof trackingHistoryEvents[number]; ageSeconds: number;
  fixes: number | null; callbacks: number | null; saved: number | null; taskStarts: number | null;
  savedAgeSeconds: number | null; reason: number | null; screenOff: boolean | null; quotaBlocked: boolean | null;
};
const boundedNumber = (value: unknown, max = 10000000): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(max, Math.floor(value)) : null;
export async function trackingHistory(): Promise<TrackingHistoryEntry[]> {
  try {
    const raw = await bridge()?.getVeetrTrackingHistory?.();
    if (!Array.isArray(raw)) return [];
    return raw.filter(row => row && typeof row === 'object' && trackingHistoryEvents.includes(row.event) && boundedNumber(row.ageSeconds) !== null && row.ageSeconds <= 604800)
      .slice(-64).map(row => ({
        event: row.event, ageSeconds: boundedNumber(row.ageSeconds, 604800)!,
        fixes: boundedNumber(row.fixes), callbacks: boundedNumber(row.callbacks), saved: boundedNumber(row.saved), taskStarts: boundedNumber(row.taskStarts),
        savedAgeSeconds: boundedNumber(row.savedAgeSeconds), reason: boundedNumber(row.reason, 1000),
        screenOff: typeof row.screenOff === 'boolean' ? row.screenOff : null,
        quotaBlocked: typeof row.quotaBlocked === 'boolean' ? row.quotaBlocked : null,
      }));
  } catch { return []; }
}
export async function markTrackingDiagnostic(event: 'tripStarted' | 'tripStopped' | 'resume' | 'recovery' | 'jsForeground' | 'jsTask' | 'saved' | 'storageFailed', count = 1): Promise<void> {
  // Native consent gates persistence, including headless task invocations. Older builds are safe no-ops.
  try { await bridge()?.recordVeetrDiagnostic?.(event, boundedNumber(count) ?? 0); } catch { /* Never fail recording for telemetry. */ }
}
