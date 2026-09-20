import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import RegattaSharingScreen from "../../app/regatta-sharing";
import { trackingRpc } from "../client";
import { startTracking } from "../service";
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  ScrollView: "ScrollView",
  Pressable: "Pressable",
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn() },
  StyleSheet: { create: (s: unknown) => s, flatten: (s: unknown) => s },
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "View" }));
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("../../components/AccountSignIn", () => () => null);
jest.mock("../ReadyRaceOptions", () => () => null);
jest.mock("../client", () => ({
  trackingRpc: jest.fn(),
  trackingClient: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user", email: "test@example.com" } } },
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}));
jest.mock("../database", () => ({
  trackingStore: async () => ({ get: async () => null, count: async () => 0 }),
}));
jest.mock("../service", () => ({
  startTracking: jest.fn(),
  stopTracking: jest.fn(),
  resumeTracking: jest.fn(),
  discardStoppedTracking: jest.fn(),
}));
const luna = {
  boatId: "luna",
  boatName: "Luna",
  seriesId: "series",
  seriesName: "Autumn series",
  open: true,
  eligible: true,
};
beforeEach(() => {
  jest.clearAllMocks();
  (trackingRpc as jest.Mock).mockResolvedValue([
    luna,
    { ...luna, boatId: "other", boatName: "Another boat" },
  ]);
});
test("tapping a boat opens a focused action view, and selection alone never starts sharing", async () => {
  const ui = render(<RegattaSharingScreen />);
  fireEvent.press(
    await ui.findByLabelText("Open tracking for Luna in Autumn series"),
  );
  expect(ui.queryByText("Another boat")).toBeNull();
  expect(ui.getByText("Start live sharing")).toBeTruthy();
  expect(startTracking).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText("Start live sharing"));
  expect(startTracking).not.toHaveBeenCalled();
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => buttons[1].onPress());
  await waitFor(() =>
    expect(startTracking).toHaveBeenCalledWith(luna, true, false),
  );
});
test.each([
  { open: false, eligible: true, reason: /Live sharing is closed/ },
  { open: true, eligible: false, reason: /not entered in a published heat/ },
])(
  "unavailable boats explain the next step and cannot start: %p",
  async ({ open, eligible, reason }) => {
    (trackingRpc as jest.Mock).mockResolvedValue([{ ...luna, open, eligible }]);
    const ui = render(<RegattaSharingScreen />);
    fireEvent.press(
      await ui.findByLabelText("Open tracking for Luna in Autumn series"),
    );
    expect(ui.getByText(reason)).toBeTruthy();
    fireEvent.press(ui.getByText("Start live sharing"));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(startTracking).not.toHaveBeenCalled();
  },
);
test("refresh retains the chosen boat and updates availability; changing boats restores the list", async () => {
  (trackingRpc as jest.Mock)
    .mockResolvedValueOnce([{ ...luna, open: false }])
    .mockResolvedValue([luna]);
  const ui = render(<RegattaSharingScreen />);
  fireEvent.press(
    await ui.findByLabelText("Open tracking for Luna in Autumn series"),
  );
  fireEvent.press(ui.getByText("Refresh regattas"));
  expect(await ui.findByText(/Live sharing is available/)).toBeTruthy();
  fireEvent.press(ui.getByText("Choose another boat"));
  expect(
    ui.getByLabelText("Open tracking for Luna in Autumn series"),
  ).toBeTruthy();
  expect(ui.queryByText("Start live sharing")).toBeNull();
});
