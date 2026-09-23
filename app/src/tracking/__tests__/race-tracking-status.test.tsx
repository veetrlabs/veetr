import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import RaceTrackingCard from "../RaceTrackingCard";
import { raceTrackingStatus } from "../raceTrackingStatus";
import { useRaceTracking } from "../useRaceTracking";
import type { TrackingSession } from "../model";
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  Pressable: "View",
  StyleSheet: { flatten: (s: unknown) => s },
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../useRaceTracking", () => ({ useRaceTracking: jest.fn() }));
const now = Date.now();
const session = {
  mode: "race",
  boatName: "LUNA",
  raceName: "Morning race",
  phase: "recording",
  expiresAt: new Date(now + 3600000).toISOString(),
  raceCheckedAt: new Date(now).toISOString(),
  lastRecordedAt: new Date(now).toISOString(),
  raceActive: true,
} as TrackingSession;
test("status separates live sharing, readiness, stale connection, GPS and stopped tracking", () => {
  expect(raceTrackingStatus(session, now).live).toBe(true);
  expect(
    raceTrackingStatus({ ...session, raceActive: false }, now).label,
  ).toMatch(/waiting for the start/);
  expect(raceTrackingStatus(session, now + 61000).label).toBe(
    "Race connection lost",
  );
  expect(
    raceTrackingStatus({ ...session, lastRecordedAt: undefined }, now).label,
  ).toBe("Waiting for GPS");
  expect(raceTrackingStatus({ ...session, phase: "stopping" }, now).label).toBe(
    "Race tracking stopped",
  );
  expect(
    raceTrackingStatus({ ...session, error: "Permission denied" }, now).live,
  ).toBe(false);
});
test("active card names the boat and race and opens map and tracking controls directly", () => {
  (useRaceTracking as jest.Mock).mockReturnValue({ session, phone: null, now });
  const ui = render(<RaceTrackingCard />);
  expect(ui.getByText("LUNA · Morning race")).toBeTruthy();
  fireEvent.press(ui.getByText("View race map"));
  expect(router.push).toHaveBeenCalledWith("/map");
  fireEvent.press(ui.getByText("Manage tracking"));
  expect(router.push).toHaveBeenCalledWith("/race-phone");
});
