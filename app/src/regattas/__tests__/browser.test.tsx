import React from "react";
import { act, render, fireEvent, waitFor } from "@testing-library/react-native";
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
  RefreshControl: "RefreshControl",
  Pressable: "View",
  Modal: "Modal",
  AppState: { currentState: "active" },
  Linking: { openURL: jest.fn() },
  StyleSheet: { flatten: (s: unknown) => s },
}));
jest.mock("../FleetMap", () => () => require("react").createElement("Text", null, "Fleet map"));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
  SafeAreaProvider: require("react-native").View,
}));
const row = {
  id: "series",
  name: "Sunday sailing",
  year: 2026,
  status: "active",
  liveBoats: 1,
  boatCount: 3,
  raceCount: 1,
  firstDate: "2026-09-20",
  lastDate: "2026-09-20",
  replayStart: "2026-09-10T12:00:00Z",
  replayEnd: "2026-09-10T13:00:00Z",
};

const makeSeries = (events = [{id:"event",name:"Sunday race",order:1,weight:1,countAs:1,completed:false,discards:[]}]) => ({
  id: "series", name: "Sunday sailing", year:2026, pointsStart:0,
  categories:[{id:"small",name:"Small boats"}], boats:[{id:"a",name:"Luna",categoryId:"small"}],
  events, races: events.map(e => ({id:`heat-${e.id}`,eventId:e.id,kind:"aggregate",order:e.order,date:"2026-09-20",weight:1,status:"published",entries:["a"],results:[{boatId:"a",status:"SCORED",points:e.order}]})),
});
beforeEach(() => {
  jest.clearAllMocks();
  (trackingClient!.rpc as jest.Mock).mockResolvedValue({data:[row],error:null});
  (trackingRpc as jest.Mock).mockImplementation((name: string) => Promise.resolve(name === "public_standings" ? makeSeries() : []));
});
test("guests open a race's results, live map and replay without authentication", async () => {
  const view = render(<RegattaBrowser />);
  await waitFor(() => expect(view.getByLabelText("View Sunday race")).toBeTruthy());
  expect(view.queryByLabelText("View Sunday sailing")).toBeNull();
  fireEvent.press(view.getByLabelText("View Sunday race"));
  await waitFor(() => expect(view.getByText("Luna")).toBeTruthy());
  expect(view.queryByText("Series standings")).toBeNull();
  expect(view.queryByText("Fleet map")).toBeNull();
  fireEvent.press(view.getAllByText("Live").at(-1)!);
  await waitFor(() => expect(trackingRpc).toHaveBeenCalledWith("public_tracking_positions", {p_series:"series"}));
  fireEvent.press(view.getByText("Replay"));
  await waitFor(() => expect(trackingRpc).toHaveBeenCalledWith("public_regatta_replay", {p_series:"series",p_at:"2026-09-10T12:00:00.000Z"}));
  expect(view.queryByText("Sign in")).toBeNull();
  view.unmount();
});
test("public directory errors are surfaced and can be retried", async () => {
  (trackingClient!.rpc as jest.Mock).mockResolvedValueOnce({error:{code:"network",message:"Connection lost"}});
  const view = render(<RegattaBrowser />);
  await waitFor(() => expect(view.getByText("Connection lost")).toBeTruthy());
  expect(view.queryByText("Refresh")).toBeNull();
  act(() => view.getByTestId("regatta-list").props.refreshControl.props.onRefresh());
  await waitFor(() => expect(view.getByLabelText("View Sunday race")).toBeTruthy());
  view.unmount();
});
test("completed undated events appear under Past and open only their own results", async () => {
  const series = makeSeries([1,2].map(n => ({id:String(n),name:`Race ${n}`,order:n,weight:1,countAs:1,completed:true,discards:[]})));
  series.races.forEach(r => r.date = "");
  (trackingRpc as jest.Mock).mockResolvedValue(series);
  const view = render(<RegattaBrowser />);
  await waitFor(() => expect(view.getByLabelText("View Race 1")).toBeTruthy());
  fireEvent.press(view.getByText("Past"));
  expect(view.getByLabelText("View Race 1")).toBeTruthy();
  expect(view.getByLabelText("View Race 2")).toBeTruthy();
  fireEvent.press(view.getByText("Upcoming"));
  expect(view.queryByLabelText("View Race 1")).toBeNull();
  fireEvent.press(view.getByText("Past"));
  fireEvent.press(view.getByLabelText("View Race 2"));
  await waitFor(() => expect(view.getByText("Luna")).toBeTruthy());
  expect(view.getByText("2")).toBeTruthy();
  expect(view.queryByText("Series standings")).toBeNull();
  expect(view.queryByText("Replay")).toBeNull();
  expect(view.queryByText("Fleet map")).toBeNull();
  expect((trackingRpc as jest.Mock).mock.calls.every(call => call[0] === "public_standings")).toBe(true);
  view.unmount();
});

test("race links to series matrix, boats and races with working Back navigation", async () => {
  const series = {...makeSeries([1,2,3].map(n=>({id:String(n),name:`Race ${n}`,order:n,weight:1,countAs:n===1?2:1,completed:true,discards:[]}))),discards:[{from:4,discard:1}]};
  (trackingRpc as jest.Mock).mockResolvedValue(series);
  const view = render(<RegattaBrowser />);
  await waitFor(()=>expect(view.getByLabelText("View Race 2")).toBeTruthy());
  fireEvent.press(view.getByLabelText("View Race 2"));
  await waitFor(()=>expect(view.getByLabelText("View series Sunday sailing")).toBeTruthy());
  fireEvent.press(view.getByLabelText("View series Sunday sailing"));
  expect(view.getByText("Race 1 ×2")).toBeTruthy();
  expect(view.getByLabelText("Total 4")).toBeTruthy();
  expect(view.getByLabelText("Race 3: 3, discarded")).toBeTruthy();
  fireEvent.press(view.getByLabelText("View boat Luna"));
  expect(view.getByText("Boat details")).toBeTruthy();
  expect(view.getByText("Full boat profile on website")).toBeTruthy();
  fireEvent.press(view.getByText("Back"));
  fireEvent.press(view.getByLabelText("View race Race 3"));
  await waitFor(()=>expect(view.getByText("Luna")).toBeTruthy());
  expect(view.getByText("3")).toBeTruthy();
  fireEvent.press(view.getByText("Back"));
  expect(view.getByLabelText("Total 4")).toBeTruthy();
  fireEvent.press(view.getByText("Back"));
  await waitFor(()=>expect(view.getByLabelText("View series Sunday sailing")).toBeTruthy());
  expect(view.getByText("2")).toBeTruthy();
  view.unmount();
});

test("multi-heat race shows combined points, heat results and explicit DNS penalties", async () => {
  const series = makeSeries();
  series.boats.push({id:"b",name:"Absent",categoryId:"small"});
  const base = series.races[0];
  const heats = [
    {...base,id:"h1",kind:undefined,name:"Rozjížďka 1",results:[{boatId:"a",status:"FINISHED",position:1,points:1}]},
    {...base,id:"h2",kind:undefined,name:"Rozjížďka 2",order:2,results:[{boatId:"a",status:"DNS",points:12}]},
  ];
  (trackingRpc as jest.Mock).mockResolvedValue({...series,races:heats});
  const view = render(<RegattaBrowser />);
  await waitFor(() => expect(view.getByLabelText("View Sunday race")).toBeTruthy());
  fireEvent.press(view.getByLabelText("View Sunday race"));
  await waitFor(() => expect(view.getByText("Combined")).toBeTruthy());
  expect(view.getByText("13")).toBeTruthy();
  expect(view.getByText("H1: 1 · H2: 12 (DNS)")).toBeTruthy();
  expect(view.queryByText("Absent")).toBeNull();
  fireEvent.press(view.getByText("Heat 2"));
  expect(view.getByText("12")).toBeTruthy();
  expect(view.getByText("DNS")).toBeTruthy();
  expect(view.queryByText("13")).toBeNull();
  fireEvent.press(view.getByText("Heat 1"));
  expect(view.queryByText("DNS")).toBeNull();
  fireEvent.press(view.getByText("Combined"));
  expect(view.getByText("13")).toBeTruthy();
  view.unmount();
});
