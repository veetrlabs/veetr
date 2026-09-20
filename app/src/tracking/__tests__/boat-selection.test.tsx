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
test("the legacy sharing screen no longer loads or offers the series fleet", async () => {
  const ui = render(<RegattaSharingScreen />);
  expect(await ui.findByText("Go to Regattas")).toBeTruthy();
  expect(trackingRpc).not.toHaveBeenCalled();
  expect(ui.queryByText("Luna")).toBeNull();
  expect(ui.queryByText("Start live sharing")).toBeNull();
  expect(startTracking).not.toHaveBeenCalled();
});
