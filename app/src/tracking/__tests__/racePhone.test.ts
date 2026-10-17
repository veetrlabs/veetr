jest.mock("../../boats/cloudBoats", () => ({cacheRaceBoat:jest.fn().mockResolvedValue({boats:[]})}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackingRpc } from '../client';
import { rememberRacePhone, savedRacePhone, racePhoneRpc, type RacePhone } from '../racePhone';
import { joinedStartLine } from '../../navigation/joinedStartLine';
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-crypto', () => ({}));
jest.mock('../client', () => ({ trackingRpc: jest.fn() }));
const phone: RacePhone = { boatId: 'boat', boatName: 'Dawn', seriesId: 'series', seriesName: 'Series', eventId: 'event', raceName: 'Race', active: true, eligible: true, linkId: 'race', valid: true, expiresAt: '2026-10-12T00:00:00Z', scheduledStart: '2026-10-11T09:00:00Z', course: { marks: [], startLine: [{ latitude: 49, longitude: 14 }, { latitude: 49, longitude: 14.01 }] } };
const now = Date.parse('2026-10-11T10:00:00Z');
beforeEach(() => {
  const values = new Map<string, string>();
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => values.get(key) ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => { values.set(key, value); });
});
test.each([{ completed: true }, { endedAt: '2026-10-11T10:00:00Z' }, { valid: false }])('confirmed end or revocation clears the cached navigation line: %j', async status => {
  await rememberRacePhone(phone, 'secret');
  expect(joinedStartLine(await savedRacePhone(), null, now)).not.toBeNull();
  (trackingRpc as jest.Mock).mockResolvedValue(status);
  await racePhoneRpc(phone.linkId, 'race_phone_status');
  const saved = await savedRacePhone();
  expect(joinedStartLine(saved, null, now)).toBeNull();
  expect(saved?.course).toEqual(phone.course); // History/course data is not deleted.
  (trackingRpc as jest.Mock).mockRejectedValue(new Error('offline'));
  await expect(racePhoneRpc(phone.linkId, 'race_phone_status')).rejects.toThrow('offline');
  expect(joinedStartLine(await savedRacePhone(), null, now)).toBeNull();
});
test('late status for the previous race cannot replace a new invitation', async () => {
  await rememberRacePhone(phone, 'secret');
  let finish!: (value: unknown) => void;
  (trackingRpc as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const request = racePhoneRpc(phone.linkId, 'race_phone_status');
  await Promise.resolve();
  await rememberRacePhone({ ...phone, linkId: 'new-race' }, 'new-secret');
  finish({ ...phone, completed: true });
  await request;
  expect((await savedRacePhone())?.linkId).toBe('new-race');
  expect(joinedStartLine(await savedRacePhone(), null, now)).not.toBeNull();
});
test('a pause keeps the current course available and a course edit refreshes it', async () => {
  await rememberRacePhone(phone, 'secret');
  const course = { ...phone.course!, startLine: [{ latitude: 43, longitude: 15 }, { latitude: 43, longitude: 15.01 }] };
  (trackingRpc as jest.Mock).mockResolvedValue({ ...phone, active: false, course });
  await racePhoneRpc(phone.linkId, 'race_phone_status');
  expect(joinedStartLine(await savedRacePhone(), null, now)?.starboard?.latitude).toBe(43);
});
test('a cache write failure does not hide a received revocation from the recorder', async () => {
  await rememberRacePhone(phone, 'secret');
  (trackingRpc as jest.Mock).mockResolvedValue({ valid: false });
  (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('storage unavailable'));
  await expect(racePhoneRpc(phone.linkId, 'race_phone_status')).resolves.toEqual({ valid: false });
});
