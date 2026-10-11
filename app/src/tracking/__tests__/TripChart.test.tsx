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
  expect(ui.getByText("● Alpha · SOG")).toBeTruthy();
  expect(ui.getByText("● Beta · SOG")).toBeTruthy();
  expect(ui.getAllByTestId("chart-path").filter(p => p.props.d?.startsWith("M0.00")).map(p => p.props.stroke)).toEqual(["red", "blue"]);
  fireEvent(ui.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
  expect(onSelect).toHaveBeenCalledWith(1);
  ui.rerender(<TripChart points={points} index={1} onSelect={onSelect} boatTracks={[boats[1]]} />);
  expect(ui.queryByText("● Alpha · SOG")).toBeNull();
  expect(ui.getByText("● Beta · SOG")).toBeTruthy();
  ui.rerender(<TripChart points={points} index={1} onSelect={onSelect} boatTracks={[]} />);
  expect(ui.getByText("Turn on a boat to compare its instruments.")).toBeTruthy();
});
