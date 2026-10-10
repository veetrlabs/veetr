import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import RacePhoneScreen from "../RacePhoneScreen";
import { trackingRpc } from "../client";
import { claimRacePhone } from "../racePhone";
import { readyForRace } from "../service";
jest.mock("../TripMap", () => () => require("react").createElement("Text", null, "Course map"));
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Text: "Text",
  View: "View",
  ScrollView: "ScrollView",
  TextInput: "TextInput",
  Pressable: "Pressable",
  Alert: { alert: jest.fn() },
  Linking: { openSettings: jest.fn() },
  StyleSheet: { flatten: (s: unknown) => s },
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "View" }));
jest.mock("expo-router", () => ({
  router: { canGoBack: () => false, replace: jest.fn(), push: jest.fn() },
}));
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("../client", () => ({ trackingRpc: jest.fn() }));
jest.mock("../seriesPhone", () => ({ savedSeriesPhone: jest.fn(), seriesPhoneStatus: jest.fn(), claimSeriesPhone: jest.fn(), connectSeriesRace: jest.fn() }));
jest.mock("../racePhone", () => ({
  claimRacePhone: jest.fn(),
  savedRacePhone: jest.fn(),
  racePhoneRpc: jest.fn(),
}));
jest.mock("../service", () => ({
  readyForRace: jest.fn(),
  resumeTracking: jest.fn(),
  stopTracking: jest.fn(),
}));
let mockSession: any = null;
jest.mock("../database", () => ({
  trackingStore: async () => ({ get: async () => mockSession }),
}));
const phone = {
  linkId: "link",
  boatId: "boat",
  boatName: "Luna",
  seriesId: "series",
  seriesName: "Series",
  eventId: "event",
  raceName: "Autumn race",
  scheduledStart: "2026-09-20T09:00:00Z",
  expiresAt: "2026-09-21T03:00:00Z",
  valid: true,
  active: false,
  eligible: true,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockSession = null;
  (trackingRpc as jest.Mock).mockResolvedValue(phone);
  (claimRacePhone as jest.Mock).mockResolvedValue(phone);
});
test("opening an invitation never pairs or starts GPS without the Ready action and consent", async () => {
  const ui = render(<RacePhoneScreen token="invitation" />);
  expect(await ui.findByText("Luna")).toBeTruthy();
  expect(claimRacePhone).not.toHaveBeenCalled();
  expect(readyForRace).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText("Ready to race"));
  expect(readyForRace).not.toHaveBeenCalled();
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => buttons[1].onPress());
  await waitFor(() => expect(readyForRace).toHaveBeenCalledWith(phone));
  expect(claimRacePhone).toHaveBeenCalledWith("invitation");
});
test("a ready session shows waiting and offers a stop action rather than asking for another start", async () => {
  mockSession = {
    ...phone,
    id: "session",
    mode: "race",
    raceLinkId: "link",
    phase: "recording",
    raceActive: false,
    raceCheckedAt: new Date().toISOString(),
  };
  const ui = render(<RacePhoneScreen token="invitation" />);
  expect(await ui.findByText("Ready — waiting for the referee")).toBeTruthy();
  expect(ui.queryByText("Ready to race")).toBeNull();
  expect(ui.getByText("Stop / leave race")).toBeTruthy();
});
test("a revoked invitation cannot hide the local stop control for an existing session", async () => {
  (trackingRpc as jest.Mock).mockResolvedValue(null);
  mockSession = {
    ...phone,
    id: "session",
    mode: "race",
    raceLinkId: "link",
    phase: "recording",
    raceActive: true,
  };
  const ui = render(<RacePhoneScreen token="revoked" />);
  expect(await ui.findByText("Stop current race tracking")).toBeTruthy();
});

test("Regattas accepts an invitation without signing in or loading a fleet", async () => {
  const { router } = require("expo-router");
  const token =
    "12345678-1234-1234-1234-123456789abc12345678-1234-1234-1234-123456789abc";
  const ui = render(<RacePhoneScreen />);
  expect(await ui.findByText("Join your boat")).toBeTruthy();
  fireEvent.changeText(
    ui.getByLabelText("Boat invitation link"),
    `https://veetr.org/join/${token}/`,
  );
  fireEvent.press(ui.getByText("Open invitation"));
  expect(router.push).toHaveBeenCalledWith(`/join/${token}`);
  expect(claimRacePhone).not.toHaveBeenCalled();
  expect(readyForRace).not.toHaveBeenCalled();
  expect(trackingRpc).not.toHaveBeenCalled();
});
test("invalid pasted links stay on the invitation form", async () => {
  const { router } = require("expo-router");
  const ui = render(<RacePhoneScreen />);
  await ui.findByText("Join your boat");
  fireEvent.changeText(
    ui.getByLabelText("Boat invitation link"),
    "https://example.com/join/not-an-invitation",
  );
  fireEvent.press(ui.getByText("Open invitation"));
  expect(
    ui.getByText(
      "Paste the complete Veetr boat invitation link sent by your referee.",
    ),
  ).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();
});

test('existing legacy live sharing remains reachable to stop or finish syncing', async()=>{
 const {router}=require('expo-router');
 mockSession={id:'legacy',mode:'live',phase:'recording',boatName:'Luna'};
 const ui=render(<RacePhoneScreen/>);
 fireEvent.press(await ui.findByText('Manage existing live sharing'));
 expect(router.push).toHaveBeenCalledWith('/regatta-sharing');
});

const seriesPhone = {
  scope: "series", linkId: "series-link", boatId: "boat", boatName: "Luna",
  seriesId: "series", seriesName: "Autumn series", valid: true, connected: false,
  races: [{eventId: "event", raceName: "Autumn race", scheduledStart: phone.scheduledStart}],
};
test("a series invitation pairs once without GPS and connects the selected race only after consent", async () => {
  const { claimSeriesPhone, connectSeriesRace } = require("../seriesPhone");
  (trackingRpc as jest.Mock).mockResolvedValue(seriesPhone);
  claimSeriesPhone.mockResolvedValue({...seriesPhone, connected: true});
  connectSeriesRace.mockResolvedValue(phone);
  const ui = render(<RacePhoneScreen token="series-token" />);
  await ui.findByText("Autumn series");
  expect(claimSeriesPhone).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText("Connect phone to series"));
  await ui.findByText("Phone connected to this series");
  expect(claimSeriesPhone).toHaveBeenCalledWith("series-token");
  expect(readyForRace).not.toHaveBeenCalled();
  fireEvent.press(ui.getByLabelText("Ready to race: Autumn race"));
  expect(connectSeriesRace).not.toHaveBeenCalled();
  await act(async () => (Alert.alert as jest.Mock).mock.calls[0][2][1].onPress());
  expect(connectSeriesRace).toHaveBeenCalledWith(expect.objectContaining({linkId:"series-link"}),"event");
  expect(readyForRace).toHaveBeenCalledWith(phone);
});
test("the saved series pairing returns after a race, without another invitation", async () => {
  const { savedSeriesPhone, seriesPhoneStatus, claimSeriesPhone, connectSeriesRace } = require("../seriesPhone");
  savedSeriesPhone.mockResolvedValue(seriesPhone);
  seriesPhoneStatus.mockResolvedValue({...seriesPhone, connected:true});
  connectSeriesRace.mockResolvedValue(phone);
  const ui = render(<RacePhoneScreen />);
  await ui.findByText("Phone connected to this series");
  expect(seriesPhoneStatus).toHaveBeenCalledWith("series-link");
  fireEvent.press(ui.getByLabelText("Ready to race: Autumn race"));
  await act(async () => (Alert.alert as jest.Mock).mock.calls[0][2][1].onPress());
  expect(claimSeriesPhone).not.toHaveBeenCalled();
  expect(readyForRace).toHaveBeenCalledWith(phone);
  savedSeriesPhone.mockReset();
});
test("a series with no published races can still be paired", async () => {
  (trackingRpc as jest.Mock).mockResolvedValue({...seriesPhone, races:[]});
  const ui = render(<RacePhoneScreen token="series-token" />);
  await ui.findByText("No upcoming published races for your boat yet. Your series invitation remains available.");
  expect(ui.getByText("Connect phone to series")).toBeTruthy();
  expect(ui.queryByText("Ready to race")).toBeNull();
});
