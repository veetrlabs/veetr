import { joinedStartLine } from '../joinedStartLine';
import { startLineDistanceAtPosition } from '../startLineDistance';
const a = { latitude: 43.75, longitude: 15.7 }, b = { latitude: 43.75, longitude: 15.71 };
const now = Date.parse('2026-10-11T08:00:00Z');
const phone = { valid: true, linkId: 'race', scheduledStart: '2026-10-11T09:00:00Z', expiresAt: '2026-10-12T09:00:00Z', course: { startLine: [a, b], marks: [] } } satisfies NonNullable<Parameters<typeof joinedStartLine>[0]>;
test('joining configures committee boat A and buoy B for map and Data-tab distance', () => {
  const line = joinedStartLine(phone, null, now)!;
  expect(line.starboard).toMatchObject(a);
  expect(line.port).toMatchObject(b);
  expect(startLineDistanceAtPosition(line, { latitude: 43.75, longitude: 15.705 })).toBeCloseTo(0);
});
test('uses bearing and length, but not an invented endpoint for bearing-only courses', () => {
  const course = { marks: [], startBearing: { origin: a, degrees: 90, distanceMetres: 250 } };
  expect(joinedStartLine({ ...phone, course }, null, now)?.port?.longitude).toBeGreaterThan(a.longitude);
  expect(joinedStartLine({ ...phone, course: { marks: [], startBearing: { origin: a, degrees: 90 } } }, null, now)).toBeNull();
});
test('uses refreshed course only for the matching race and respects removed lines', () => {
  const session = { mode: 'race', raceLinkId: 'race', phase: 'recording', course: { marks: [], startLine: [b, a] } } satisfies NonNullable<Parameters<typeof joinedStartLine>[1]>;
  expect(joinedStartLine(phone, session, now)?.starboard).toMatchObject(b);
  expect(joinedStartLine(phone, { ...session, raceLinkId: 'other' }, now)?.starboard).toMatchObject(a);
  expect(joinedStartLine(phone, { ...session, course: null }, now)).toBeNull();
});
test('completed, expired, unlinked and invalid races leave the manual line available', () => {
  for (const value of [null, { ...phone, completed: true }, { ...phone, valid: false }, { ...phone, endedAt: '2026-10-11T07:00:00Z' }, { ...phone, expiresAt: '2026-10-10T07:00:00Z' }, { ...phone, course: null }]) {
    expect(joinedStartLine(value, null, now)).toBeNull();
  }
});
