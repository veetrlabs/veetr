import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export const nativeStages = ['registered', 'requestAccepted', 'requestFailed', 'broadcast', 'fix', 'jobScheduled', 'jobStarted', 'taskDispatched', 'taskFinished', 'serviceStarted', 'serviceStopped'] as const;
export const nativeBooleans = ['enabled', 'serviceRunning', 'screenInteractive', 'powerSave', 'deviceIdle', 'batteryExempt', 'gpsProviderEnabled', 'networkProviderEnabled'] as const;
export const nativeNumbers = ['windowAgeSeconds', 'lastFixDelayMs', 'pendingJobs', 'quotaBlockedJobs', ...nativeStages.flatMap(stage => [`${stage}Count`, `${stage}ScreenOffCount`, `${stage}AgeSeconds`])];
export type NativeDiagnostics = Record<string, number | boolean | null>;
type Bridge = { setVeetrDiagnosticsEnabled?: (value: boolean) => Promise<void>; getVeetrDiagnostics?: () => Promise<unknown> };
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
