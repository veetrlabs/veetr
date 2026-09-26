import { recordingStatus } from '../recordingStatus';
import type { TrackingSession } from '../model';

const now = Date.parse('2026-09-25T10:00:00Z');
const session = { phase: 'recording' } as TrackingSession;
test('an armed recorder without saved positions is not presented as healthy recording', () => {
  expect(recordingStatus(session, now)).toBe('Waiting for GPS');
  expect(recordingStatus({ ...session, lastRecordedAt: new Date(now - 45000).toISOString() }, now)).toBe('GPS updates stopped');
  expect(recordingStatus({ ...session, lastRecordedAt: new Date(now - 5000).toISOString() }, now)).toBe('Recording');
  expect(recordingStatus({ ...session, phase: 'stopping' }, now)).toBe('Stopped');
});
