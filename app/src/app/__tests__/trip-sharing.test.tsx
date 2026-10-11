import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import TripSharingPage from "../trip-sharing";
import { trackingStore } from "../../tracking/database";
import { selectTripBoat, setTripSharing } from "../../tracking/tripSharing";

const mockScrollTo = jest.fn();
jest.mock("react-native", () => {
  const React = require("react");
  return {
    Text: "Text",
    View: "View",
    Pressable: "View",
    Share: { share: jest.fn() },
    ScrollView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      return React.createElement("View", props);
    }),
    StyleSheet: { flatten: (s: unknown) => s },
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ id: "trip" }),
  useFocusEffect: (fn: any) => require("react").useEffect(fn, [fn]),
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "View" }));
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("../../tracking/database", () => ({ trackingStore: jest.fn() }));
jest.mock("../../tracking/tripSharing", () => ({
  selectTripBoat: jest.fn(),
  setTripSharing: jest.fn(),
}));
jest.mock("../../tracking/TripOptions", () => ({
  TripAccountLink: () => null,
  TripOptions: ({ onVisibility }: any) =>
    require("react").createElement(
      "Text",
      { onPress: () => onVisibility("public") },
      "Public",
    ),
}));
jest.mock("../../tracking/TripBoatPicker", () => ({
  __esModule: true,
  default: ({ onSelect }: any) =>
    require("react").createElement(
      "Text",
      { onPress: () => onSelect({ id: "boat", name: "Dawn" }) },
      "Select Dawn",
    ),
}));

test("missing boat directs the user to selection, then allows publishing after selection is saved", async () => {
  let trip = {
    session: { id: "trip", mode: "local", phase: "stopping" },
    points: [],
  };
  const updateTrip = jest.fn();
  (trackingStore as jest.Mock).mockResolvedValue({
    localRecordings: async () => [trip],
    updateTrip,
  });
  (selectTripBoat as jest.Mock).mockImplementation(async () => {
    trip = { ...trip, session: { ...trip.session, boatId: "boat" } } as any;
  });
  const ui = render(<TripSharingPage />);
  await waitFor(() => expect(ui.getByText("Public")).toBeTruthy());
  expect(ui.getByText("Save private trip")).toBeTruthy();
  fireEvent.press(ui.getByText("Public"));
  expect(ui.getByText("Choose a boat before sharing.")).toBeTruthy();
  fireEvent.press(ui.getByText("Choose a boat first."));
  expect(mockScrollTo).toHaveBeenCalled();
  expect(setTripSharing).not.toHaveBeenCalled();
  expect(updateTrip).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText("Select Dawn"));
  await waitFor(() => expect(ui.getByText("Publish trip")).toBeTruthy());
  expect(ui.queryByText("Choose a boat before sharing.")).toBeNull();
  fireEvent.press(ui.getByText("Publish trip"));
  await waitFor(() =>
    expect(setTripSharing).toHaveBeenCalledWith(
      "trip",
      "public",
      "My sailing trip",
    ),
  );
  ui.unmount();
});
