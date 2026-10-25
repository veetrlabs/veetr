import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import LocalRecording from "../LocalRecording";
import TripChart from "../TripChart";
import type { TrackingPoint, TrackingSession } from "../model";
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../service", () => ({
  startLocalTracking: jest.fn(),
  stopTracking: jest.fn(),
}));
jest.mock("../TrackingIcon", () => () => null);
jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Path: "Path",
  Circle: "Circle",
  Line: "Line",
}));
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  Pressable: "View",
  StyleSheet: { flatten: (s: unknown) => s },
}));
const start = Date.parse("2026-09-16T08:00:00Z");
const session = {
  id: "one",
  phase: "recording",
  startedAt: new Date(start).toISOString(),
  expiresAt: new Date(start + 43200000).toISOString(),
  lastRecordedAt: new Date(start + 56000).toISOString(),
  backgroundEnabled: true,
} as TrackingSession;
test("recording metrics expose explanations on tap without recovery clutter", () => {
  const ui = render(
    <LocalRecording
      session={session}
      count={12}
      now={start + 60000}
      busy={false}
      run={jest.fn()}
    />,
  );
  expect(ui.getByLabelText("Saved positions: 12")).toBeTruthy();
  expect(ui.getByLabelText("Last GPS fix: 4s ago")).toBeTruthy();
  expect(ui.getByLabelText("Elapsed time: 1m")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Saved positions: 12"));
  expect(ui.getByText(/GPS positions saved privately/)).toBeTruthy();
  expect(ui.queryByText("Resume GPS")).toBeNull();
  expect(ui.queryByText("Location settings")).toBeNull();
});
test("stopped recording leaves export and deletion in trip detail", () => {
  const ui = render(
    <LocalRecording
      session={{ ...session, phase: "stopping" }}
      count={12}
      now={start + 60000}
      busy={false}
      run={jest.fn()}
    />,
  );
  expect(ui.getByText("Start recording")).toBeTruthy();
  expect(ui.queryByText("Stop recording")).toBeNull();
  expect(ui.queryByText("Delete recording")).toBeNull();
});
const points: TrackingPoint[] = [0, 5000, 50000].map((ms) => ({
  recordedAt: new Date(start + ms).toISOString(),
  latitude: 43,
  longitude: 16,
  accuracyM: 5,
  sogMps: null,
  cogDeg: null,
  source: "phone",
}));
test("chart gesture follows time; wind can appear without SOG and missing wind stays absent", () => {
  const select = jest.fn();
  const ui = render(<TripChart points={points} index={0} onSelect={select} />);
  const timeline = ui.getByRole("adjustable");
  fireEvent(timeline, "layout", { nativeEvent: { layout: { width: 364 } } });
  fireEvent(timeline, "responderMove", { nativeEvent: { pageX: 160 } });
  expect(select).toHaveBeenLastCalledWith(1);
  fireEvent(timeline, "responderRelease", { nativeEvent: { pageX: 352 } });
  expect(select).toHaveBeenLastCalledWith(2);
  fireEvent(timeline, "accessibilityAction", {
    nativeEvent: { actionName: "increment" },
  });
  expect(select).toHaveBeenLastCalledWith(1);
  expect(ui.queryByText("● AWS")).toBeNull();
  ui.rerender(
    <TripChart
      points={[{ ...points[0], instruments: { aws: 12, tws: null } }]}
      index={0}
      onSelect={select}
    />,
  );
  expect(ui.getByText("● AWS")).toBeTruthy();
  expect(ui.getByText("12.0")).toBeTruthy();
  expect(ui.queryByText("● TWS")).toBeNull();
});
test('chart scrubbing returns trip indices and reset restores the full range', () => {
  const select = jest.fn();
  const data = points.map((p, i) => ({ ...p, longitude: i === 0 ? 20 : 16, sogMps: 2 }));
  const ui = render(<TripChart points={data} index={1} onSelect={select} />);
  fireEvent(ui.getByRole('adjustable'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(select).toHaveBeenLastCalledWith(2);
  expect(ui.queryByLabelText('Zoom chart in')).toBeNull();
  expect(ui.queryByLabelText('Zoom chart out')).toBeNull();
  const timeline = ui.getByRole('adjustable');
  fireEvent(timeline, 'layout', { nativeEvent: { layout: { width: 364 } } });
  for (const [left, right] of [[142, 242], [92, 292]]) {
    fireEvent(timeline, 'responderMove', { nativeEvent: { touches: [{ pageX: left, pageY: 0 }, { pageX: right, pageY: 0 }] } });
  }
  expect(ui.getByText('Selected time range')).toBeTruthy();
  fireEvent.press(ui.getByText('Reset chart'));
  expect(ui.queryByText('Selected time range')).toBeNull();
});
test('two-finger pinch narrows timeline without scrubbing on release', () => {
  const select = jest.fn();
  const data = Array.from({ length: 11 }, (_, i) => ({ ...points[0], recordedAt: new Date(start + i * 10000).toISOString(), sogMps: 2 }));
  const ui = render(<TripChart points={data} index={5} onSelect={select} />);
  const timeline = ui.getByRole('adjustable');
  fireEvent(timeline, 'layout', { nativeEvent: { layout: { width: 364 } } });
  const move = (left: number, right: number) => fireEvent(timeline, 'responderMove', {
    nativeEvent: { pageX: left, touches: [{ pageX: left, pageY: 0 }, { pageX: right, pageY: 0 }] },
  });
  move(142, 242);
  move(92, 292);
  expect(ui.getByText('Selected time range')).toBeTruthy();
  expect(ui.getByRole('adjustable').props.accessibilityValue.max).toBe(4);
  select.mockClear();
  fireEvent(timeline, 'responderRelease', { nativeEvent: { pageX: 292 } });
  expect(select).not.toHaveBeenCalled();
});
