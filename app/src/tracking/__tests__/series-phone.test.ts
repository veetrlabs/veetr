import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackingRpc } from "../client";
import {
  claimSeriesPhone,
  connectSeriesRace,
  savedSeriesPhone,
  seriesPhoneStatus,
} from "../seriesPhone";
import { racePhoneSecret } from "../racePhone";
jest.mock("@react-native-async-storage/async-storage", () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    clear: jest.fn(async () => values.clear()),
  };
});
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_: string, token: string) => `hash-${token}`,
  randomUUID: () => "12345678-1234-1234-1234-123456789012",
}));
jest.mock("../client", () => ({ trackingRpc: jest.fn() }));
const phone = {
  scope: "series" as const,
  linkId: "series-link",
  boatId: "boat",
  boatName: "Luna",
  seriesId: "series",
  seriesName: "Autumn",
  valid: true,
  connected: true,
  races: [],
};
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});
test("a lost claim response retries with the same persisted device secret", async () => {
  (trackingRpc as jest.Mock)
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValue(phone);
  await expect(claimSeriesPhone("token")).rejects.toThrow("network");
  await claimSeriesPhone("token");
  expect((trackingRpc as jest.Mock).mock.calls[0][1].device_secret).toBe(
    (trackingRpc as jest.Mock).mock.calls[1][1].device_secret,
  );
  expect(await savedSeriesPhone()).toEqual(phone);
  await seriesPhoneStatus(phone.linkId);
  expect(trackingRpc).toHaveBeenLastCalledWith(
    "series_phone_status",
    expect.objectContaining({
      lid: phone.linkId,
      device_secret: expect.any(String),
    }),
  );
});
test("race credentials can change while the series pairing survives an app restart", async () => {
  (trackingRpc as jest.Mock).mockResolvedValue(phone);
  await claimSeriesPhone("token");
  const secret = (trackingRpc as jest.Mock).mock.calls[0][1].device_secret;
  (trackingRpc as jest.Mock).mockResolvedValue({
    linkId: "first",
    eventId: "race1",
  });
  await connectSeriesRace(phone, "race1");
  expect(await racePhoneSecret("first")).toBe(secret);
  expect(await savedSeriesPhone()).toEqual(phone);
  (trackingRpc as jest.Mock).mockResolvedValue({
    linkId: "second",
    eventId: "race2",
  });
  await connectSeriesRace((await savedSeriesPhone())!, "race2");
  expect(await racePhoneSecret("second")).toBe(secret);
  expect(trackingRpc).toHaveBeenLastCalledWith("connect_series_race_phone", {
    lid: phone.linkId,
    device_secret: secret,
    event_id: "race2",
  });
});
