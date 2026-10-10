import React from "react";
import { render } from "@testing-library/react-native";
import CourseLayer, { courseCoordinates, type RaceCourse } from "../CourseLayer";
jest.mock("react-native", () => ({ Text: "Text", View: "View", StyleSheet: {flatten: (value: unknown) => value} }));
jest.mock("../../components/NativeMap", () => ({ Marker: "Marker", Polyline: "Polyline" }));
const course: RaceCourse = {
  startLine: [{latitude: 49, longitude: 14}, {latitude: 49, longitude: 14.002}],
  marks: [{id: "mark", name: "Mark 1", latitude: 49.004, longitude: 14.001, rounding: "port"}],
};
test("renders A/B and numbered rounding marks, connecting the course to the start midpoint", () => {
  const ui = render(<CourseLayer course={course} />);
  expect(ui.getByText("A")).toBeTruthy();
  expect(ui.getByText("B")).toBeTruthy();
  expect(ui.getByText("1 ↶")).toBeTruthy();
  const route = ui.UNSAFE_getAllByType("Polyline" as any)[1].props.coordinates;
  expect(route[0].latitude).toBe(49);
  expect(route[0].longitude).toBeCloseTo(14.001);
  expect(route[1]).toEqual(course.marks[0]);
  expect(courseCoordinates(course)).toHaveLength(3);
});
test("bearing-only geometry does not invent a buoy B, and missing courses render nothing", () => {
  const ui = render(<CourseLayer course={{marks: [], startBearing: {origin: {latitude:49,longitude:14}, degrees:90}}} />);
  expect(ui.getByText("A")).toBeTruthy();
  expect(ui.queryByText("B")).toBeNull();
  ui.rerender(<CourseLayer />);
  expect(ui.toJSON()).toBeNull();
});
