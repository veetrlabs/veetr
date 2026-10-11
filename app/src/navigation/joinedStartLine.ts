import { startGeometry } from '../../../veetr.org/src/features/racing/course';
import type { TrackingSession } from '../tracking/model';
import type { RacePhone } from '../tracking/racePhone';
import type { PhoneStartLine } from './phoneStartLine';

// The joined race is a temporary source; never replace the sailor's saved line.
export function joinedStartLine(phone: Pick<RacePhone, 'valid' | 'completed' | 'endedAt' | 'expiresAt' | 'linkId' | 'scheduledStart' | 'course'> | null, session: Pick<TrackingSession, 'mode' | 'raceLinkId' | 'phase' | 'course'> | null, now: number): PhoneStartLine | null {
  if (!phone || !phone.valid || phone.completed || phone.endedAt || Date.parse(phone.expiresAt) <= now) return null;
  const sameSession = session?.mode === 'race' && session.raceLinkId === phone.linkId;
  if (sameSession && session.phase === 'stopping') return null;
  const course = sameSession && session.course !== undefined ? session.course : phone.course;
  if (!course || (!course.startLine && !course.startBearing?.distanceMetres)) return null;
  const ends = startGeometry(course);
  if (ends.length !== 2) return null;
  const mark = (p: typeof ends[number]) => ({ ...p, accuracyM: 0, capturedAt: phone.scheduledStart });
  return { starboard: mark(ends[0]), port: mark(ends[1]) };
}
