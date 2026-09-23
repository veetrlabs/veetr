import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import Map from "../Map";
import { useJoinedFleet } from "../../regattas/useJoinedFleet";
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "View",
  StyleSheet: {
    absoluteFill: {},
    create: (s: unknown) => s,
    flatten: (s: unknown) => s,
  },
  Linking: { openURL: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Circle: "Circle",
  Path: "Path",
}));
jest.mock("../../components/NativeMap", () => ({
  MapView: "MapView",
  Marker: "Marker",
  Polyline: "Polyline",
  Circle: "Circle",
  UrlTile: "UrlTile",
}));
jest.mock("../../components/GPSStatusButton", () => () => null);
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("../../context/BLEContext", () => ({
  useBLE: () => ({ state: { isConnected: false } }),
}));
jest.mock("../../navigation/NavigationContext", () => ({
  useNavigation: () => ({
    fix: { latitude: 50, longitude: 14, source: "phone" },
    trail: [],
    phoneStartLine: { line: {} },
  }),
}));
jest.mock("../../tracking/useRaceTracking", () => ({
  useRaceTracking: () => ({
    session: {
      mode: "race",
      raceLinkId: "joined",
      boatId: "mine",
      boatName: "LUNA",
      raceName: "Morning",
    },
    phone: null,
    now: Date.now(),
  }),
}));
jest.mock("../../regattas/useJoinedFleet", () => ({
  useJoinedFleet: jest.fn(),
}));
test("map combines the local own boat with race competitors without duplicate own markers", () => {
  const own = {
    boatId: "mine",
    boatName: "LUNA",
    latitude: 50,
    longitude: 14,
    recordedAt: new Date().toISOString(),
    trail: [],
    sogMps: 1,
  };
  (useJoinedFleet as jest.Mock).mockReturnValue({
    positions: [own, { ...own, boatId: "other", boatName: "JOY" }],
    error: "",
    loading: false,
  });
  const ui = render(<Map />);
  expect(useJoinedFleet).toHaveBeenCalledWith("joined");
  const markers = ui.UNSAFE_getAllByType("Marker" as any);
  expect(markers.map((m) => m.props.title)).toEqual(["JOY", "LUNA · You"]);
  expect(ui.getByText("Show fleet")).toBeTruthy();
  expect(ui.getByLabelText("Manage race tracking")).toBeTruthy();
});
