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
jest.mock("../../tracking/TripChart", () => ({ __esModule: true, default: (props: any) => require("react").createElement("View", { ...props, testID: "trip-chart" }) }));
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  Pressable: "View",
  ScrollView: "View",
  Switch: "View",
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
    true,
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
    true,
  );
  fireEvent.press(ui.getByText("Hide competitors"));
  expect(ui.getByTestId("fleet").props.positions).toHaveLength(1);
  ui.unmount();
});

test("spectator selects a boat's shared chart and scrubs the fleet together", () => {
  const tracks = ['a', 'b'].flatMap(boatId => trip.points.map(p => ({ ...p, boatId, boatName: boatId, sessionId: boatId })));
  (useReplayTracks as jest.Mock).mockReturnValue({ meta: { start, end: start + 125000, heats: [] }, positions: [], tracks, loading: false, error: '', retry: jest.fn() });
  const ui = render(<RaceReplay seriesId="series" eventId="event" />);
  fireEvent.press(ui.getByText('b'));
  const chart = ui.getByTestId('trip-chart');
  expect(chart.props.points.every((p: any) => p.boatId === 'b')).toBe(true);
  require('@testing-library/react-native').act(() => chart.props.onSelect(2));
  expect(useReplayTracks).toHaveBeenLastCalledWith('series', 'event', undefined, start + 120000, true, true);
  ui.unmount();
});
