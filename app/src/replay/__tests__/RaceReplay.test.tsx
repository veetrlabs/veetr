import React from "react";
import { act, render, fireEvent } from "@testing-library/react-native";
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
  default: (props: any) =>
    require("react").createElement("View", { testID: "fleet", ...props }),
}));
jest.mock("../../tracking/TripChart", () => ({ __esModule: true, default: (props: any) => require("react").createElement("View", { ...props, testID: "trip-chart" }) }));
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  Pressable: "View",
  ScrollView: "View",
  Switch: "Switch",
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
  expect(ui.queryByText("+1 min")).toBeNull();
  expect(ui.queryByText("−1 min")).toBeNull();
  expect(ui.queryByText("Play")).toBeNull();
  expect(ui.queryByText("10×")).toBeNull();
  expect(ui.queryByLabelText("Replay timeline")).toBeNull();
  expect(ui.queryByText("Chart follows map")).toBeNull();
  expect(ui.queryByText("Fit whole trip")).toBeNull();
  expect(ui.getByTestId("trip-chart").props.region).toBeUndefined();
  expect(ui.getByTestId("trip-chart").props.showRangeLabel).toBe(false);
  expect(ui.getByTestId("trip-chart").props.points).toHaveLength(4);
  act(() => ui.getByTestId("trip-chart").props.onSelect(3));
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

test("boat switches control both the map and shared chart without changing the timeline", () => {
  const tracks = ['a', 'b'].flatMap(boatId => trip.points.map(p => ({ ...p, boatId, boatName: boatId, sessionId: boatId })));
  const positions = ['a', 'b'].map(boatId => ({ ...trip.points[0], boatId, boatName: boatId, trail: [] }));
  (useReplayTracks as jest.Mock).mockReturnValue({ meta: { start, end: start + 125000, heats: [] }, positions, tracks, loading: false, error: '', retry: jest.fn() });
  const ui = render(<RaceReplay seriesId="series" eventId="event" />);
  expect(ui.queryByText("Boat instruments")).toBeNull();
  const chart = () => ui.getByTestId('trip-chart');
  expect(chart().props.boatTracks.map((b: any) => b.id)).toEqual(['a', 'b']);
  expect(ui.getAllByText('a')).toHaveLength(1);
  act(() => chart().props.onSelect(2));
  expect(useReplayTracks).toHaveBeenLastCalledWith('series', 'event', undefined, start + 120000, true, true);
  fireEvent(ui.getByLabelText('a'), 'valueChange', false);
  expect(chart().props.boatTracks.map((b: any) => b.id)).toEqual(['b']);
  expect(ui.getByTestId('fleet').props.positions.map((p: any) => p.boatId)).toEqual(['b']);
  expect(ui.getByTestId('fleet').props.routes.map((b: any) => b.id)).toEqual(['b']);
  expect(chart().props.index).toBe(2);
  fireEvent(ui.getByLabelText('b'), 'valueChange', false);
  expect(chart().props.boatTracks).toEqual([]);
  expect(ui.getByTestId('fleet').props.positions).toEqual([]);
  expect(ui.getByLabelText('a').props.value).toBe(false);
  expect(ui.getByLabelText('b').props.value).toBe(false);
  fireEvent(ui.getByLabelText('a'), 'valueChange', true);
  expect(chart().props.boatTracks.map((b: any) => b.id)).toEqual(['a']);
  expect(chart().props.index).toBe(2);
  ui.unmount();
});
