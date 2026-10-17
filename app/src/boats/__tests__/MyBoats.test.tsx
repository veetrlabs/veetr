jest.mock("../BoatPublishing", () => ({__esModule:true,default:()=>null}));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("../../tracking/client", () => ({trackingRpc:jest.fn()}));
jest.mock("../BoatModelLookup", () => ({__esModule:true,default:()=>null}));
jest.mock("expo-crypto", () => ({randomUUID:()=>"polar-id"}));
import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import MyBoats from "../../app/my-boats";
import { privateFleet, savePrivateBoat, deletePrivateBoat, selectPrivateBoat } from "../privateBoats";
let mockPolarInteraction: ((active:boolean)=>void) | undefined;
jest.mock('../../polar/BoatPolarDetails', () => ({__esModule:true,default:({boatId,onInteractionChange}:any)=>{mockPolarInteraction=onInteractionChange;return require('react').createElement('Text',null,`Polar for ${boatId}`);}}));
jest.mock('../../polar/sync', () => ({restorePolars:jest.fn()}));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})), useFocusEffect: (fn: any) => require("react").useEffect(fn, [fn]) }));
jest.mock("react-native", () => ({ Alert: { alert: jest.fn() }, Text: "Text", TextInput: "TextInput", View: "View", ScrollView: "View", RefreshControl: "RefreshControl", Switch: "Switch", Pressable: "View", StyleSheet: { flatten: (s: unknown) => s } }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "View" }));
jest.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("../privateBoats", () => ({ linkedRaceBoat: jest.requireActual("../privateBoats").linkedRaceBoat, linkRaceBoat: jest.fn(), privateFleet: jest.fn(), savePrivateBoat: jest.fn(), selectPrivateBoat: jest.fn(), deletePrivateBoat: jest.fn() }));
jest.mock("../../tracking/seriesPhone", () => ({
  savedSeriesPhone: async () => ({ linkId: "link", boatId: "race-boat", boatName: "Luna", seriesName: "Series", valid: true, races: [{ eventId: "race", raceName: "Sunday" }] }),
  seriesPhoneStatus: async () => ({ linkId: "link", boatId: "race-boat", boatName: "Luna", seriesName: "Series", valid: true, races: [{ eventId: "race", raceName: "Sunday" }] }),
}));
beforeEach(() => { (useLocalSearchParams as jest.Mock).mockReturnValue({}); });

test("dashboard boat links open that boat's details and polar", async () => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ boatId: "b" });
  (privateFleet as jest.Mock).mockResolvedValue({ boats: [
    { id: "a", name: "A", className: "", sailNumber: "" },
    { id: "b", name: "B", className: "", sailNumber: "" },
  ], activeId: "a" });
  const ui = render(<MyBoats />);
  await waitFor(() => expect(ui.getByText("Polar for b")).toBeTruthy());
  expect(ui.getByLabelText("Boat name").props.value).toBe("B");
  expect(ui.queryByText("Polar for a")).toBeNull();
  ui.unmount();
});

test("shows invitation access separately and opens the selected race without starting tracking", async () => {
  (privateFleet as jest.Mock).mockResolvedValue({ boats: [] });
  const ui = render(<MyBoats />);
  await waitFor(() => expect(ui.getByText("Luna ›")).toBeTruthy());
  fireEvent.press(ui.getByText("Join Sunday"));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/race-phone", params: { eventId: "race" } });
  ui.unmount();
});
test("private details save on blur", async () => {
  const boat = { id: "private", name: "Dawn", className: "", sailNumber: "" };
  (privateFleet as jest.Mock).mockResolvedValue({ boats: [boat], activeId: boat.id });
  (savePrivateBoat as jest.Mock).mockResolvedValue({ boats: [{ ...boat, name: "Dawn II" }], activeId: boat.id });
  const ui = render(<MyBoats />);
  await waitFor(() => expect(ui.getByText("Dawn ›")).toBeTruthy());
  fireEvent.press(ui.getByText("Dawn ›"));
  expect(ui.getByText("Polar for private")).toBeTruthy();
  fireEvent.changeText(ui.getByLabelText("Boat name"), "Dawn II");
  fireEvent(ui.getByLabelText("Boat name"), "blur");
  await waitFor(() => expect(savePrivateBoat).toHaveBeenCalledWith({ ...boat, name: "Dawn II" }));
  ui.unmount();
});

test("creating a boat returns to the list only after saving succeeds", async () => {
  (privateFleet as jest.Mock).mockResolvedValue({ boats: [] });
  (savePrivateBoat as jest.Mock).mockRejectedValueOnce(new Error("Could not save"));
  const ui = render(<MyBoats />);
  await waitFor(() => expect(ui.getByText("Luna ›")).toBeTruthy());
  fireEvent.press(ui.getByText("Create private boat"));
  fireEvent.changeText(ui.getByLabelText("Boat name"), "Boat A");
  fireEvent.press(ui.getByText("Create private boat"));
  await waitFor(() => expect(ui.getByText("Could not save")).toBeTruthy());
  expect(ui.getByLabelText("Boat name").props.value).toBe("Boat A");
  (savePrivateBoat as jest.Mock).mockResolvedValueOnce({
    boats: [{ id: "new", name: "Boat A", className: "", sailNumber: "" }], activeId: "new",
  });
  fireEvent.press(ui.getByText("Create private boat"));
  await waitFor(() => expect(ui.getByText("Boat A ›")).toBeTruthy());
  expect(ui.queryByLabelText("Boat name")).toBeNull();
  expect(ui.getByText("Active for private trips")).toBeTruthy();
  expect(ui.queryByText("Could not save")).toBeNull();
  ui.unmount();
});

test("boat details let users activate a boat and require confirmation before deletion", async () => {
  const boat = { id: "a", name: "A", className: "", sailNumber: "" };
  (privateFleet as jest.Mock).mockResolvedValue({ boats: [boat] });
  (selectPrivateBoat as jest.Mock).mockResolvedValue({ boats: [boat], activeId: "a" });
  (deletePrivateBoat as jest.Mock).mockResolvedValue({ boats: [] });
  const ui = render(<MyBoats />);
  await waitFor(() => expect(ui.getByText("A ›")).toBeTruthy());
  fireEvent.press(ui.getByText("A ›"));
  fireEvent(ui.getByLabelText("Use for private trips"), "valueChange", true);
  await waitFor(() => expect(ui.getByLabelText("Use for private trips").props.value).toBe(true));
  expect(selectPrivateBoat).toHaveBeenCalledWith("a");
  (selectPrivateBoat as jest.Mock).mockResolvedValue({boats:[boat]});
  fireEvent(ui.getByLabelText("Use for private trips"), "valueChange", false);
  await waitFor(() => expect(ui.getByLabelText("Use for private trips").props.value).toBe(false));
  expect(selectPrivateBoat).toHaveBeenLastCalledWith(undefined);
  fireEvent.press(ui.getByText("Delete boat"));
  expect(deletePrivateBoat).not.toHaveBeenCalled();
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  expect(actions[0].style).toBe("cancel");
  await act(async () => { await actions[1].onPress(); });
  await waitFor(() => expect(ui.getByText("My boats")).toBeTruthy());
  expect(deletePrivateBoat).toHaveBeenCalledWith("a");
  expect(ui.queryByText("A ›")).toBeNull();
  ui.unmount();
});

 test("a missed chart release cannot lock the next touch or page scrolling", async () => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({boatId:"b"});
  (privateFleet as jest.Mock).mockResolvedValue({boats:[{id:"b",name:"B",className:"",sailNumber:""}],activeId:"b"});
  const ui=render(<MyBoats/>);
  await waitFor(()=>expect(ui.getByText("Polar for b")).toBeTruthy());
  const scroll=()=>ui.UNSAFE_getAllByType('View' as any).find(v=>v.props.keyboardShouldPersistTaps==='handled')!;
  act(()=>mockPolarInteraction?.(true));
  expect(scroll().props.scrollEnabled).toBe(false);
  act(()=>scroll().props.onTouchEnd({nativeEvent:{touches:[]}}));
  expect(scroll().props.scrollEnabled).toBe(true);
  act(()=>mockPolarInteraction?.(true));
  act(()=>scroll().props.onTouchCancel());
  expect(scroll().props.scrollEnabled).toBe(true);
  act(()=>mockPolarInteraction?.(true));
  act(()=>scroll().props.onStartShouldSetResponderCapture({nativeEvent:{touches:[{}]}}));
  expect(scroll().props.scrollEnabled).toBe(true);
  ui.unmount();
 });

 test("race preview opens the cached public boat instead of a previously linked private boat", async () => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({raceBoatId:"race-boat"});
  (privateFleet as jest.Mock).mockResolvedValue({boats:[{id:"local",name:"Mine",className:"",sailNumber:""}, {id:"cached",name:"Luna",className:"",sailNumber:"",racePreview:true,downloadedFrom:{server:process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",boatId:"race-boat",baseline:""}}],raceLinks:[{server:process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",raceBoatId:"race-boat",localBoatId:"local"}]});
  const ui=render(<MyBoats/>);
  await waitFor(()=>expect(ui.getByText("Polar for cached")).toBeTruthy());
  expect(ui.queryByText("Polar for race-boat")).toBeNull();
  expect(ui.getByLabelText("Boat name").props.value).toBe("Luna");
  ui.unmount();
 });


test("downloaded profiles are read-only without a confirmed owner", async () => {
  const boat = {id:"downloaded",name:"Luna",className:"",sailNumber:"",racePreview:true,downloadedFrom:{server:"",boatId:"race",baseline:""}};
  (useLocalSearchParams as jest.Mock).mockReturnValue({boatId:boat.id});
  (privateFleet as jest.Mock).mockResolvedValue({boats:[boat]});
  const ui = render(<MyBoats/>);
  await waitFor(() => expect(ui.getByLabelText("Boat name").props.editable).toBe(false));
  expect(ui.getByLabelText("Draft (m)").props.editable).toBe(false);
  expect(ui.getByText("Use for private trips")).toBeTruthy();
  ui.unmount();
});
