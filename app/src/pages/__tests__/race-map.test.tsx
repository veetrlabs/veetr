import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import Map from "../Map";
import { useBLE } from "../../context/BLEContext";
import { useNavigation } from "../../navigation/NavigationContext";
import { useJoinedFleet } from "../../regattas/useJoinedFleet";
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
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
  SvgXml: "SvgXml",
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
  useBLE: jest.fn(() => ({ state: { isConnected: false } })),
}));
jest.mock("../../navigation/NavigationContext", () => ({
  useNavigation: jest.fn(() => ({
    fix: { latitude: 50, longitude: 14, source: "phone" },
    trail: [],
    phoneStartLine: { line: {} },
  })),
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
  expect(ui.queryByLabelText("Manage race tracking")).toBeNull();
  fireEvent.press(ui.getByLabelText(/Show race details/));
  expect(ui.getByLabelText("Manage race tracking")).toBeTruthy();
  expect(ui.getByText("LUNA · Morning")).toBeTruthy();
  fireEvent.press(ui.getByLabelText(/Hide race details/));
  expect(ui.queryByText("LUNA · Morning")).toBeNull();
});

test("live map renders wind wedges and full heading ray before a camera event, then follows viewport changes", () => {
  (useBLE as jest.Mock).mockReturnValue({ state: { isConnected: false, sailingData: { recordingInstruments: { heading: 90, awa: -30, twa: -60 } } } });
  (useNavigation as jest.Mock).mockReturnValue({ fix: { latitude: 50, longitude: 14, course: 45, source: "phone" }, deviceFresh: true, trail: [], phoneStartLine: { line: {} } });
  (useJoinedFleet as jest.Mock).mockReturnValue({ positions: [], loading: false, error: "" });
  const ui = render(<Map />);
  const map = ui.UNSAFE_getByType("MapView" as any);
  expect(map.props.rotateEnabled).toBe(false);
  expect(map.props.pitchEnabled).toBe(false);
  const symbol = ui.UNSAFE_getByType("SvgXml" as any).props.xml;
  expect(symbol).toContain('rotate(60 56 56)');
  expect(symbol).toContain('rotate(30 56 56)');
  const ray = () => ui.UNSAFE_getAllByType("Polyline" as any).find(p => p.props.strokeColor === 'black')!;
  const firstEnd = ray().props.coordinates[1].longitude;
  expect(firstEnd).toBeGreaterThan(14.01);
  fireEvent(map, 'regionChangeComplete', { latitude: 50, longitude: 14, latitudeDelta: .1, longitudeDelta: .1 });
  expect(ray().props.coordinates[1].longitude).toBeGreaterThan(firstEnd);
  (useNavigation as jest.Mock).mockReturnValue({ fix: { latitude: 50, longitude: 14, course: 45, source: "phone" }, deviceFresh: false, trail: [], phoneStartLine: { line: {} } });
  ui.rerender(<Map />);
  expect(ui.UNSAFE_getByType("SvgXml" as any).props.xml).not.toContain('rotate(60 56 56)');
  expect(ray().props.lineDashPattern).toEqual([6, 5]);
});
test('live map exposes course-up toggle and separate COG line above one knot', () => {
  (useBLE as jest.Mock).mockReturnValue({ state: { isConnected: false, sailingData: { recordingInstruments: { heading: 90, awa: -30, twa: -60 } } } });
  (useNavigation as jest.Mock).mockReturnValue({ fix: { latitude: 50, longitude: 14, course: 45, sogKnots: 5, source: "phone" }, deviceFresh: true, trail: [], phoneStartLine: { line: {} } });
  (useJoinedFleet as jest.Mock).mockReturnValue({ positions: [], loading: false, error: "" });
  const ui = render(<Map />);
  expect(ui.getByText('North up')).toBeTruthy();
  fireEvent.press(ui.getByLabelText('Course-up map'));
  expect(ui.getByText('Course up')).toBeTruthy();
  expect(ui.getByLabelText('Course-up map').props.accessibilityState.selected).toBe(true);
  const line = ui.UNSAFE_getAllByType('Polyline' as any).find(p => p.props.strokeColor === '#2563eb');
  expect(line?.props.lineDashPattern).toEqual([8, 6]);
});

test("finished race disappears from live map while own phone position remains", () => {
  (useBLE as jest.Mock).mockReturnValue({ state: { isConnected: false } });
  (useNavigation as jest.Mock).mockReturnValue({ fix: { latitude: 50, longitude: 14, source: 'phone' }, trail: [], phoneStartLine: { line: {} } });
  (useJoinedFleet as jest.Mock).mockReturnValue({ positions: [], loading: false, error: '', finished: true });
  const ui = render(<Map />);
  expect(ui.queryByText('Show fleet')).toBeNull();
  expect(ui.queryByLabelText('Manage race tracking')).toBeNull();
  expect(ui.UNSAFE_getAllByType('Marker' as any).map(m => m.props.title)).toEqual(['phone']);
});

test('only own boat has long direction lines even when delayed competitors overlap it', () => {
  (useBLE as jest.Mock).mockReturnValue({ state: { isConnected: true, sailingData: { recordingInstruments: { heading: 90 } } } });
  (useNavigation as jest.Mock).mockReturnValue({ fix: { latitude: 50, longitude: 14, course: 140, sogKnots: 5 }, deviceFresh: true, trail: [], phoneStartLine: { line: {} } });
  const competitor = { boatId: 'other', boatName: 'Other', latitude: 50, longitude: 14, recordedAt: new Date(Date.now()-120000).toISOString(), sogMps: 3, cogDeg: 200, instruments: { heading: 30 }, trail: [] };
  (useJoinedFleet as jest.Mock).mockReturnValue({ positions: [competitor, { ...competitor, boatId: 'third' }], loading: false, error: '' });
  const ui = render(<Map />);
  expect(ui.UNSAFE_getAllByType('Marker' as any)).toHaveLength(3);
  const lines = ui.UNSAFE_getAllByType('Polyline' as any).filter(p => p.props.coordinates.length > 1 && ['black', '#2563eb'].includes(p.props.strokeColor));
  expect(lines).toHaveLength(2);
  expect(lines.map(p => p.props.strokeColor)).toEqual(['black', '#2563eb']);
});

test('touching the live map releases follow before either drag or pinch begins', () => {
  (useJoinedFleet as jest.Mock).mockReturnValue({positions: [], finished: true, error: '', loading: false});
  const ui = render(<Map />);
  const recenter = () => ui.getByLabelText('Recenter and follow GPS');
  expect(recenter().props.accessibilityState.selected).toBe(true);
  const map = ui.UNSAFE_getByType('MapView' as any);
  expect(map.props.scrollEnabled).toBe(true);
  expect(map.props.zoomEnabled).toBe(true);
  // No pan callback: a pinch begins with touchStart too.
  fireEvent(map, 'touchStart', {nativeEvent: {touches: [{identifier: 1}, {identifier: 2}]}});
  expect(recenter().props.accessibilityState.selected).toBe(false);
  fireEvent(map, 'regionChangeComplete', {latitude: 51, longitude: 15, latitudeDelta: .1, longitudeDelta: .1});
  expect(recenter().props.accessibilityState.selected).toBe(false);
  fireEvent.press(recenter());
  expect(recenter().props.accessibilityState.selected).toBe(true);
});
