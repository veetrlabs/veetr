import { withErrorHistory, errorOccurredAt } from '../errorHistory';
import { trackingErrorMessage } from '../errorMessage';
import { tripGaps } from '../tripGaps';
import type { TrackingSession, TrackingPoint } from '../model';

const session = { id: 'trip', phase: 'recording' } as TrackingSession;
const failure = "Call to function 'ExpoLocation.startLocationUpdatesAsync' has been rejected. java.lang.NullPointerException: SharedPreferences.getAll()";
const time = '2026-09-27T15:32:00Z';
test('retains exact local exception and first occurrence, while displaying a friendly warning', () => {
  const failed = withErrorHistory(session, { error: failure, lastTaskError: failure }, time);
  expect(failed.errorHistory).toHaveLength(1);
  expect(failed.errorHistory![0]).toEqual({ message: failure, occurredAt: time, operation: 'background_start' });
  expect(errorOccurredAt(failed)).toBe(time);
  const warning = trackingErrorMessage(failed.error, errorOccurredAt(failed))!;
  expect(warning.text).toContain("Background recording couldn't start at ");
  expect(warning.text).not.toMatch(/java|Exception|SharedPreferences/);
  expect(withErrorHistory(failed, { error: failure }, '2026-09-27T15:33:00Z').errorHistory).toHaveLength(1);
});
test('only background recovery clears a background failure, preserving recovery time', () => {
  const failed = withErrorHistory(session, { error: failure, lastTaskError: failure }, time);
  expect(withErrorHistory(failed, { lastForegroundFixAt: time }).error).toBe(failure);
  expect(withErrorHistory(failed, { error: undefined, lastTaskError: undefined }).error).toBe(failure);
  const recovered = withErrorHistory(failed, { backgroundEnabled: true }, '2026-09-27T15:37:00Z');
  expect(recovered.error).toBeUndefined();
  expect(recovered.lastTaskError).toBeUndefined();
  expect(recovered.errorHistory![0].recoveredAt).toBe('2026-09-27T15:37:00Z');
  expect(withErrorHistory(recovered, { error: failure }, '2026-09-27T16:00:00Z').errorHistory).toHaveLength(2);
});
test('background recovery does not discard unrelated errors', () => {
  expect(withErrorHistory(session, { error: 'Storage unavailable', backgroundEnabled: true }).error).toBe('Storage unavailable');
  expect(trackingErrorMessage('java.lang.NullPointerException')!.text).not.toContain('java');
  expect(trackingErrorMessage(failure)!.text).not.toContain(' at ');
});
test('gap detection uses chronological timestamps and ignores normal cadence', () => {
  const points = [45, 0, 5, 10].map(seconds => ({ recordedAt: new Date(Date.parse(time) + seconds * 1000).toISOString() } as TrackingPoint));
  expect(tripGaps(points)).toEqual([{ start: Date.parse(time) + 10000, end: Date.parse(time) + 45000, duration: 35000 }]);
});

test('speed rejection explains uploads without raw SQL or a GPS settings instruction', () => {
  const raw = 'new row for relation "race_phone_points" violates check constraint "race_phone_points_sog_mps_check"';
  const warning = trackingErrorMessage(raw, time)!;
  expect(warning.text).toContain('invalid speed reading blocked uploads');
  expect(warning.text).toContain('remain saved on this phone');
  expect(warning.text).not.toMatch(/race_phone_points|constraint/);
  expect(warning.settings).toBe(false);
  expect(trackingErrorMessage('TypeError: Network request failed')?.settings).toBe(false);
});
