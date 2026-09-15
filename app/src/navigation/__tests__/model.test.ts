import { navigationFix } from "../model";
import type { BLEState } from "../../context/BLEContext";
import type { TrackingPoint } from "../../tracking/model";
const now = Date.now();
const phone: TrackingPoint = {
  recordedAt: new Date(now).toISOString(),
  latitude: 0,
  longitude: 14,
  accuracyM: 5,
  sogMps: 2,
  cogDeg: 90,
  source: "phone",
};
const device = {
  isConnected: true,
  lastMessageTime: now,
  sailingData: { gpsValid: true, lat: 49, lon: 14, gpsSpeed: 6, course: 120 },
} as BLEState;
test("phone speed converts metres per second to knots and preserves equator coordinates", () => {
  const result = navigationFix(
    phone,
    { ...device, isConnected: false },
    false,
    now,
  );
  expect(result.fix?.source).toBe("Phone GPS");
  expect(result.fix?.latitude).toBe(0);
  expect(result.fix?.sogKnots).toBeCloseTo(3.8877);
  expect(result.deviceFresh).toBe(false);
});
test("fresh device GPS wins during the same recording", () => {
  expect(navigationFix(phone, device, false, now).fix?.source).toBe(
    "Veetr GPS",
  );
  expect(navigationFix(phone, device, true, now).fix?.source).toBe("Veetr GPS");
});
test("stale or invalid device data falls back to phone and stale phone data is unavailable", () => {
  expect(
    navigationFix(
      phone,
      { ...device, lastMessageTime: now - 20000 },
      false,
      now,
    ).fix?.source,
  ).toBe("Phone GPS");
  expect(
    navigationFix(
      phone,
      { ...device, sailingData: { ...device.sailingData, gpsValid: false } },
      false,
      now,
    ).fix?.source,
  ).toBe("Phone GPS");
  expect(navigationFix(phone, device, true, now + 20000).fix).toBeNull();
});
test("unknown GPS speed and course stay unknown; zero speed stays zero", () => {
  expect(
    navigationFix(
      { ...phone, sogMps: null, cogDeg: null },
      { ...device, isConnected: false },
      true,
      now,
    ).fix?.sogKnots,
  ).toBeNull();
  expect(
    navigationFix(
      { ...phone, sogMps: 0 },
      { ...device, isConnected: false },
      true,
      now,
    ).fix?.sogKnots,
  ).toBe(0);
});
