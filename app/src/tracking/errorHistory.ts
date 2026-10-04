import type { TrackingSession } from './model';

export const backgroundStartError = (text: string) =>
  /startLocationUpdatesAsync|Background GPS did not start/i.test(text);

/** Persist bounded technical history locally, alongside the exported trip. */
export function withErrorHistory(session: TrackingSession, patch: Partial<TrackingSession>, now = new Date().toISOString()): TrackingSession {
  const next = { ...session, ...patch };
  if (patch.backgroundEnabled !== true) {
    for (const field of ['error', 'lastTaskError'] as const) {
      if (session[field] && backgroundStartError(session[field]!) && !next[field]) next[field] = session[field];
    }
  }
  const history = (session.errorHistory ?? []).map(item => ({ ...item }));
  for (const field of ['error', 'lastTaskError'] as const) {
    const text = patch[field];
    if (text && text !== session[field] && !history.some(item => !item.recoveredAt && item.message === text)) {
      history.push({ occurredAt: now, operation: backgroundStartError(text) ? 'background_start' : 'tracking', message: text });
    }
  }
  // A foreground fix is not proof that background recording recovered.
  if (patch.backgroundEnabled === true) {
    for (const field of ['error', 'lastTaskError'] as const) {
      if (next[field] && backgroundStartError(next[field]!)) next[field] = undefined;
    }
  }
  for (const item of history) {
    if (!item.recoveredAt && item.message !== next.error && item.message !== next.lastTaskError) item.recoveredAt = now;
  }
  next.errorHistory = history.slice(-30);
  return next;
}

export function errorOccurredAt(session?: TrackingSession | null): string | undefined {
  const message = session?.error || session?.lastTaskError;
  return session?.errorHistory?.slice().reverse().find(item => !item.recoveredAt && item.message === message)?.occurredAt;
}
