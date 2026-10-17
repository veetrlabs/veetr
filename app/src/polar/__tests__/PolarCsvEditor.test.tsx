import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import PolarCsvEditor, { polarCsv } from "../PolarCsvEditor";
import { polarRepository } from "../repository";
const reference = {
  id: "orc",
  name: "Boat",
  source: "orc" as const,
  version: "1",
  createdAt: "2026-10-13T00:00:00Z",
  speedBasis: "water" as const,
  points: [{ tws: 8, twa: 60, speed: 5.123456789 }],
};
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  Pressable: "Pressable",
  TextInput: "TextInput",
  StyleSheet: { flatten: (s: unknown) => s },
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => "custom-revision" }));
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("../../i18n", () => ({
  t: (s: string) => s,
  translateMessage: (s: string) => s,
}));
jest.mock("../repository", () => ({
  polarRepository: { setPolar: jest.fn() },
}));
beforeEach(() => jest.clearAllMocks());
function editor(polar: typeof reference | undefined = reference) {
  const preview = jest.fn(),
    saved = jest.fn();
  const ui = render(
    <PolarCsvEditor
      boatId="boat-a"
      reference={polar}
      onPreview={preview}
      onSaved={saved}
    />,
  );
  fireEvent.press(ui.getByLabelText("Edit polar data"));
  return { ui, preview, saved, input: () => ui.getByLabelText("Polar CSV") };
}
test("prefills without rounding; previews valid edits, keeps last valid curve on errors, saves custom revision on blur", async () => {
  const { ui, input, preview, saved } = editor();
  expect(input().props.value).toBe("TWS,TWA,speed\n8,60,5.123456789");
  fireEvent(input(), "blur");
  expect(polarRepository.setPolar).not.toHaveBeenCalled();
  fireEvent.changeText(input(), "TWS,TWA,speed\n8,60,6");
  expect(preview.mock.calls.at(-1)[0].points[0].speed).toBe(6);
  expect(polarRepository.setPolar).not.toHaveBeenCalled();
  const count = preview.mock.calls.length;
  fireEvent.changeText(input(), "TWS,TWA,speed\n8,60,");
  expect(preview).toHaveBeenCalledTimes(count);
  fireEvent(input(), "blur");
  expect(polarRepository.setPolar).not.toHaveBeenCalled();
  expect(ui.getByRole("alert")).toBeTruthy();
  fireEvent.changeText(input(), "TWS,TWA,speed\n8,60,6");
  (polarRepository.setPolar as jest.Mock).mockResolvedValue({
    polars: [],
    observationSets: [],
  });
  fireEvent(input(), "blur");
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(polarRepository.setPolar).toHaveBeenCalledWith(
    "boat-a",
    expect.objectContaining({
      id: "custom-revision",
      source: "manual",
      name: "Boat",
      speedBasis: "water",
      points: [{ tws: 8, twa: 60, speed: 6 }],
    }),
  );
  expect(reference.points[0].speed).toBe(5.123456789);
});
test("empty boats can create a reference; failed saves keep the draft and can retry", async () => {
  const saved = jest.fn();
  const view = render(
    <PolarCsvEditor boatId="empty" onPreview={jest.fn()} onSaved={saved} />,
  );
  fireEvent.press(view.getByLabelText("Edit polar data"));
  expect(view.getByLabelText("Polar CSV").props.value).toBe("");
  (polarRepository.setPolar as jest.Mock)
    .mockRejectedValueOnce(new Error("Storage unavailable"))
    .mockResolvedValueOnce({ polars: [], observationSets: [] });
  fireEvent.changeText(
    view.getByLabelText("Polar CSV"),
    "TWS,TWA,speed\n6,45,4",
  );
  fireEvent(view.getByLabelText("Polar CSV"), "blur");
  await waitFor(() =>
    expect(view.getByText("Storage unavailable")).toBeTruthy(),
  );
  expect(view.getByLabelText("Polar CSV").props.value).toContain("6,45,4");
  fireEvent(view.getByLabelText("Polar CSV"), "blur");
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(polarRepository.setPolar).toHaveBeenLastCalledWith(
    "empty",
    expect.objectContaining({ name: "Custom polar" }),
  );
});
test("collapsing saves valid edits and keeps invalid drafts visible", async () => {
  const { ui, input } = editor();
  fireEvent.changeText(input(), "bad");
  fireEvent.press(ui.getByLabelText("Edit polar data"));
  expect(input()).toBeTruthy();
  (polarRepository.setPolar as jest.Mock).mockResolvedValue({
    polars: [],
    observationSets: [],
  });
  fireEvent.changeText(input(), "TWS,TWA,speed\n8,60,7");
  await act(async () => fireEvent.press(ui.getByLabelText("Edit polar data")));
  expect(ui.queryByLabelText("Polar CSV")).toBeNull();
});
test("same-reference refresh does not erase a draft; another boat resets it", () => {
  const preview = jest.fn(),
    saved = jest.fn();
  const ui = render(
    <PolarCsvEditor
      boatId="a"
      reference={reference}
      onPreview={preview}
      onSaved={saved}
    />,
  );
  fireEvent.press(ui.getByLabelText("Edit polar data"));
  fireEvent.changeText(ui.getByLabelText("Polar CSV"), "TWS,TWA,speed\n8,60,7");
  ui.rerender(
    <PolarCsvEditor
      boatId="a"
      reference={{ ...reference }}
      onPreview={preview}
      onSaved={saved}
    />,
  );
  expect(ui.getByLabelText("Polar CSV").props.value).toContain("8,60,7");
  ui.rerender(
    <PolarCsvEditor boatId="b" onPreview={preview} onSaved={saved} />,
  );
  expect(ui.getByLabelText("Polar CSV").props.value).toBe("");
  expect(polarCsv(undefined)).toBe("");
});
