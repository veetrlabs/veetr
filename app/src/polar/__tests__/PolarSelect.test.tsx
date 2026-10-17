import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PolarSelect } from "../PolarSelect";
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  Pressable: ({ children, ...props }: any) =>
    require("react").createElement(
      "View",
      { accessible: true, ...props },
      children,
    ),
  StyleSheet: { flatten: (s: unknown) => s },
}));
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
test("select stays collapsed, marks the current option and changes values without an action list", () => {
  const change = jest.fn();
  const screen = render(
    <PolarSelect
      accessibilityLabel="Benchmark"
      selectedValue="a"
      onValueChange={change}
    >
      <PolarSelect.Item value="a" label="Official" />
      <PolarSelect.Item value="b" label="Learned" />
    </PolarSelect>,
  );
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(screen.getByText("Official")).toBeTruthy();
  fireEvent.press(screen.getByRole("combobox"));
  expect(screen.getAllByRole("radio")[0].props.accessibilityState.checked).toBe(
    true,
  );
  fireEvent.press(screen.getByText("Learned"));
  expect(change).toHaveBeenCalledWith("b");
  expect(screen.queryByRole("radiogroup")).toBeNull();
});
