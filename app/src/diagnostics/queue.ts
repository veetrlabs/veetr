// Queue ownership and consent are independent of the tracking/database queues.
export type DiagnosticEvent = {
  id: string; installationId: string; occurredAt: string; consent: 'automatic' | 'manual';
  event: 'health' | 'gps_restart' | 'gps_error' | 'upload_error' | 'manual' | 'app_state';
  appVersion: string; build: string; platform: string; osVersion: string; model: string;
  state: string; foregroundPermission: string; backgroundPermission: string;
  tracking: string; fixAgeSeconds: number | null; uploadAgeSeconds: number | null;
  accuracyM: number | null; pendingCount: number; recoveryCount: number;
  errorCode: 'none' | 'permission' | 'network' | 'gps' | 'tracking';
  pipeline?: {
    foregroundCallbackAgeSeconds: number | null; backgroundCallbackAgeSeconds: number | null;
    taskCallbackAgeSeconds: number | null; batchSize: number | null;
    deliveryDelayMs: number | null; rejectedFixes: number | null;
    backgroundRequested: boolean; precisePermission: boolean | null; storageAvailable: boolean;
  };
  native?: import('./native').NativeDiagnostics | null;
};
export type QueueState = { enabled: boolean; installationId: string | null; events: DiagnosticEvent[] };
export const emptyState = (): QueueState => ({ enabled: false, installationId: null, events: [] });
export function enqueue(state: QueueState, event: DiagnosticEvent, now: number): QueueState {
  if (event.consent === 'automatic' && !state.enabled) return state;
  return { ...state, events: [...state.events.filter(e => now - Date.parse(e.occurredAt) < 7 * 86400000), event].slice(-100) };
}
export function diagnosticErrorCode(error: unknown): DiagnosticEvent['errorCode'] {
  // Never send the original message: URLs, tokens and user content may be embedded.
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return 'none';
  if (/permission|denied|unauthorized/i.test(message)) return 'permission';
  if (/network|fetch|offline|timeout|abort/i.test(message)) return 'network';
  if (/gps|location|accuracy/i.test(message)) return 'gps';
  return 'tracking';
}
export const ageSeconds = (stamp: string | undefined, now: number) => {
  const value = stamp ? Date.parse(stamp) : NaN;
  return Number.isFinite(value) ? Math.max(0, Math.min(2592000, Math.round((now - value) / 1000))) : null;
};
