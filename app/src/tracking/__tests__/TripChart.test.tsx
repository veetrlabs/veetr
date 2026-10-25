import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import TripChart from "../TripChart";
import type { TrackingPoint } from "../model";
jest.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("react-native", () => ({
  Text: "Text", View: "View", Pressable: "View", StyleSheet: { flatten: (s: unknown) => s },
}));
jest.mock("react-native-svg", () => ({
  __esModule: true, default: "Svg", Circle: "Circle", Line: "Line",
  Path: (props: any) => require("react").createElement("Path", { ...props, testID: "chart-path" }),
}));
const points: TrackingPoint[] = [0, 10].map(second => ({
  recordedAt: new Date(second * 1000).toISOString(), latitude: 43, longitude: 15,
  source: "phone", accuracyM: 5, sogMps: 1, cogDeg: 0,
}));
test("renders every visible boat and keeps the shared timeline adjustable", () => {
  const onSelect = jest.fn();
  const boats = [
    { id: "a", name: "Alpha", color: "red", points },
    { id: "b", name: "Beta", color: "blue", points },
  ];
  const ui = render(<TripChart points={points} index={0} onSelect={onSelect} boatTracks={boats} />);
  expect(ui.queryByText(/Alpha/)).toBeNull();
  expect(ui.queryByText(/Beta/)).toBeNull();
  expect(ui.getByText("━ SOG")).toBeTruthy();
  expect(ui.getAllByTestId("chart-path").filter(p => p.props.d?.startsWith("M0.00")).map(p => p.props.stroke)).toEqual(["red", "blue"]);
  fireEvent(ui.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
  expect(onSelect).toHaveBeenCalledWith(1);
  ui.rerender(<TripChart points={points} index={1} onSelect={onSelect} boatTracks={[boats[1]]} />);
  expect(ui.queryByText("● Alpha · SOG")).toBeNull();
  expect(ui.queryByText(/Beta/)).toBeNull();
  expect(ui.getByText("━ SOG")).toBeTruthy();
  ui.rerender(<TripChart points={points} index={1} onSelect={onSelect} boatTracks={[]} />);
  expect(ui.getByText("Turn on a boat to compare its instruments.")).toBeTruthy();
});

test('map zoom filters speeds and keeps separate visits disconnected with original sample selection', () => {
  const data = [20, 15, 15, 20, 15, 15, 20].map((longitude, i) => ({
    ...points[0], longitude, recordedAt: new Date(i * 10000).toISOString(), sogMps: longitude === 20 ? 20 : 1,
  }));
  const region = { latitude: 43, longitude: 15, latitudeDelta: 1, longitudeDelta: 1 };
  const select = jest.fn();
  const ui = render(<TripChart points={data} index={1} onSelect={select} region={region} />);
  expect(ui.getByRole('adjustable').props.accessibilityValue.max).toBe(3);
  const path = ui.getAllByTestId('chart-path').find(p => p.props.fill === 'none')!.props.d;
  expect(path.match(/M/g)).toHaveLength(2);
  // The displayed maximum has 8% headroom; off-map spikes must not affect it.
  expect(path).toContain('M0.00,10.37');
  fireEvent(ui.getByRole('adjustable'), 'responderRelease', { nativeEvent: { pageX: 300 } });
  expect(select).toHaveBeenLastCalledWith(5);
  ui.rerender(<TripChart points={data} index={1} onSelect={select} region={{ ...region, longitude: 30 }} />);
  expect(ui.getByText('No recorded positions in this view. Zoom out or fit the whole trip.')).toBeTruthy();
  expect(ui.getAllByTestId('chart-path').find(p => p.props.fill === 'none')!.props.d).toBe('');
});

test('equivalent map events preserve chart zoom; moving the map resets it', () => {
  const data = Array.from({ length: 11 }, (_, i) => ({ ...points[0], recordedAt: new Date(i * 10000).toISOString() }));
  const region = { latitude: 43, longitude: 15, latitudeDelta: 1, longitudeDelta: 1 };
  const select = jest.fn();
  const ui = render(<TripChart points={data} index={5} onSelect={select} region={region} />);
  const timeline = ui.getByRole('adjustable');
  fireEvent(timeline, 'layout', { nativeEvent: { layout: { width: 364 } } });
  for (const [left, right] of [[142, 242], [92, 292]]) {
    fireEvent(timeline, 'responderMove', { nativeEvent: { touches: [{ pageX: left, pageY: 0 }, { pageX: right, pageY: 0 }] } });
  }
  expect(ui.getByText('Selected time range')).toBeTruthy();
  ui.rerender(<TripChart points={data} index={5} onSelect={select} region={{ ...region }} />);
  expect(ui.getByText('Selected time range')).toBeTruthy();
  ui.rerender(<TripChart points={data} index={5} onSelect={select} region={{ ...region, latitudeDelta: 2 }} />);
  expect(ui.queryByText('Selected time range')).toBeNull();
  expect(ui.getByRole('adjustable').props.accessibilityValue.max).toBe(10);
});

test('section boundaries are drawn at their times within the visible chart range',()=>{
 const ui=render(<TripChart points={points} index={0} onSelect={jest.fn()} sections={[
  {startedAt:points[0].recordedAt,propulsion:'sailing-only'},
  {startedAt:new Date(5000).toISOString(),propulsion:'engine-used'},
  {startedAt:new Date(20000).toISOString(),propulsion:'unknown'},
 ]}/>);
 const boundaries=ui.UNSAFE_getAllByType('Line' as any).filter(line=>line.props.strokeDasharray==='2 3');
 expect(boundaries).toHaveLength(1);
 expect(boundaries[0].props.x1).toBe(160);
});
