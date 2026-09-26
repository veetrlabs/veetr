import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import RaceReplay from "../RaceReplay";
import { useReplayTracks } from "../useReplayTracks";
import type { Trip } from "../../tracking/trip";
jest.mock("../useReplayTracks", () => ({
  useReplayTracks: jest.fn(() => ({
    meta: null,
    positions: [],
    loading: false,
    error: "",
    retry: jest.fn(),
  })),
}));
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("../../regattas/FleetMap", () => ({
  __esModule: true,
  default: ({ positions }: any) =>
    require("react").createElement("View", { testID: "fleet", positions }),
}));
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  Pressable: "View",
  ScrollView: "View",
  StyleSheet: { flatten: (s: unknown) => s },
}));
const start = Date.parse("2026-09-24T10:00:00Z");
const trip: Trip = {
  session: {
    id: "trip",
    userId: "",
    seriesId: "series",
    seriesName: "Series",
    boatId: "own",
    boatName: "Luna",
    mode: "race",
    phase: "stopping",
    startedAt: new Date(start).toISOString(),
    expiresAt: new Date(start + 3600000).toISOString(),
  },
  points: [0, 5, 120, 125].map((t) => ({
    recordedAt: new Date(start + t * 1000).toISOString(),
    latitude: 49,
    longitude: 14,
    accuracyM: 5,
    sogMps: 1,
    cogDeg: 0,
    source: "phone",
  })),
};
test("own track is visible offline and seeking preserves gaps; competitors are requested only on demand", () => {
  const ui = render(
    <RaceReplay seriesId="series" eventId="event" own={trip} />,
  );
  expect(useReplayTracks).toHaveBeenLastCalledWith(
    "series",
    "event",
    undefined,
    start,
    false,
  );
  expect(ui.getByTestId("fleet").props.positions[0].boatId).toBe("own");
  fireEvent.press(ui.getByText("+1 min"));
  fireEvent.press(ui.getByText("+1 min"));
  fireEvent.press(ui.getByText("+1 min"));
  expect(ui.getByTestId("fleet").props.positions[0].trailSegments).toHaveLength(
    2,
  );
  fireEvent.press(ui.getByText("Show competitors"));
  expect(useReplayTracks).toHaveBeenLastCalledWith(
    "series",
    "event",
    undefined,
    start + 125000,
    true,
  );
  fireEvent.press(ui.getByText("Hide competitors"));
  expect(ui.getByTestId("fleet").props.positions).toHaveLength(1);
  ui.unmount();
});
