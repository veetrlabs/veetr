import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import RegattaBrowser from "../RegattaBrowser";
import { trackingClient, trackingRpc } from "../../tracking/client";
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("../../tracking/client", () => ({
  trackingClient: { rpc: jest.fn() },
  trackingRpc: jest.fn(),
}));
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  ScrollView: "ScrollView",
  Pressable: "View",
  Modal: "Modal",
  AppState: { currentState: "active" },
  Linking: { openURL: jest.fn() },
  StyleSheet: { flatten: (s: unknown) => s },
}));
jest.mock("../FleetMap", () => () => null);
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
}));
const row = {
  id: "series",
  name: "Sunday sailing",
  year: 2026,
  status: "active",
  boatCount: 3,
  raceCount: 1,
  firstDate: "2026-09-20",
  lastDate: "2026-09-20",
  replayStart: "2026-09-10T12:00:00Z",
  replayEnd: "2026-09-10T13:00:00Z",
};
beforeEach(() => {
  jest.clearAllMocks();
  (trackingClient!.rpc as jest.Mock).mockResolvedValue({
    data: [row],
    error: null,
  });
  (trackingRpc as jest.Mock).mockResolvedValue([]);
});
test("guests browse and open live and replay without authentication", async () => {
  const view = render(<RegattaBrowser />);
  await waitFor(() =>
    expect(view.getByLabelText("View Sunday sailing")).toBeTruthy(),
  );
  fireEvent.press(view.getByLabelText("View Sunday sailing"));
  await waitFor(() =>
    expect(trackingRpc).toHaveBeenCalledWith("public_tracking_positions", {
      p_series: "series",
    }),
  );
  fireEvent.press(view.getByText("Replay"));
  await waitFor(() =>
    expect(trackingRpc).toHaveBeenCalledWith("public_regatta_replay", {
      p_series: "series",
      p_at: "2026-09-10T12:00:00.000Z",
    }),
  );
  expect(view.queryByText("Sign in")).toBeNull();
  view.unmount();
});
test("public directory errors are surfaced and can be retried", async () => {
  (trackingClient!.rpc as jest.Mock).mockResolvedValueOnce({
    error: { code: "network", message: "Connection lost" },
  });
  const view = render(<RegattaBrowser />);
  await waitFor(() => expect(view.getByText("Connection lost")).toBeTruthy());
  fireEvent.press(view.getByText("Refresh"));
  await waitFor(() =>
    expect(view.getByLabelText("View Sunday sailing")).toBeTruthy(),
  );
  view.unmount();
});
