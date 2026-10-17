import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import BoatPublishing from "../BoatPublishing";
import { boatAccount, ownedBoats, uploadBoat } from "../cloudBoats";
jest.mock("../cloudBoats", () => ({
  boatAccount: jest.fn(),
  ownedBoats: jest.fn(),
  uploadBoat: jest.fn(),
}));
jest.mock("../privateBoats", () => ({
  privateFleet: async () => ({ boats: [] }),
  raceBoatIdForLocal: () => "cloud",
}));
jest.mock("../../components/AccountSignIn", () => ({
  __esModule: true,
  default: () => require("react").createElement("Text", null, "Sign-in form"),
}));
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("expo-router", () => ({
  useFocusEffect: (fn: any) => require("react").useEffect(fn, [fn]),
}));
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  Pressable: "View",
  Switch: "Switch",
  Linking: { openURL: jest.fn() },
  StyleSheet: { flatten: (s: unknown) => s },
}));
beforeEach(() => {
  jest.clearAllMocks();
  (boatAccount as jest.Mock).mockResolvedValue({ id: "owner" });
  (ownedBoats as jest.Mock).mockResolvedValue([]);
});
test("publishing requires an explicit action and retains failure for retry", async () => {
  const refreshed = jest.fn();
  const ui = render(<BoatPublishing boatId="local" onRefresh={refreshed} />);
  await waitFor(() => expect(ui.getByLabelText("Upload boat")).toBeTruthy());
  expect(uploadBoat).not.toHaveBeenCalled();
  expect(ui.getByLabelText("Upload publicly").props.value).toBe(false);
  (uploadBoat as jest.Mock)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ id: "cloud", updatedAt: "now" });
  fireEvent.press(ui.getByLabelText("Upload boat"));
  await waitFor(() => expect(ui.getByText("Offline")).toBeTruthy());
  expect(refreshed).not.toHaveBeenCalled();
  fireEvent.press(ui.getByLabelText("Upload boat"));
  await waitFor(() =>
    expect(ui.getByText("Boat uploaded to your account.")).toBeTruthy(),
  );
  expect(ui.getByLabelText("Upload boat")).toBeTruthy();
  expect(refreshed).toHaveBeenCalledTimes(1);
  ui.unmount();
});
test("an existing owned boat sends the loaded revision and signed-out users see sign-in", async () => {
  const cloud = { id: "cloud", updatedAt: "previous" };
  (ownedBoats as jest.Mock).mockResolvedValue([cloud]);
  (uploadBoat as jest.Mock).mockResolvedValue(cloud);
  const ui = render(<BoatPublishing boatId="local" onRefresh={() => {}} />);
  await waitFor(() => expect(ui.getByLabelText("Upload boat")).toBeTruthy());
  fireEvent.press(ui.getByLabelText("Upload boat"));
  await waitFor(() =>
    expect(uploadBoat).toHaveBeenCalledWith("local", false, cloud),
  );
  ui.unmount();
  (boatAccount as jest.Mock).mockResolvedValue(null);
  const signedOut = render(
    <BoatPublishing boatId="local" onRefresh={() => {}} />,
  );
  await waitFor(() => expect(signedOut.getByText("Sign-in form")).toBeTruthy());
  expect(signedOut.queryByLabelText("Upload boat")).toBeNull();
  signedOut.unmount();
});

test("the public switch changes only the next upload and an existing public profile is explained", async () => {
  const cloud = {
    id: "cloud",
    updatedAt: "previous",
    uploadPublic: false,
    publiclyVisible: true,
  };
  (ownedBoats as jest.Mock).mockResolvedValue([cloud]);
  (uploadBoat as jest.Mock).mockResolvedValue(cloud);
  const ui = render(<BoatPublishing boatId="local" onRefresh={() => {}} />);
  await waitFor(() =>
    expect(
      ui.getByText(
        "This boat already has a public profile. A private upload does not remove its previously published details.",
      ),
    ).toBeTruthy(),
  );
  fireEvent(ui.getByLabelText("Upload publicly"), "valueChange", true);
  expect(uploadBoat).not.toHaveBeenCalled();
  fireEvent.press(ui.getByLabelText("Upload boat"));
  await waitFor(() =>
    expect(uploadBoat).toHaveBeenCalledWith("local", true, cloud),
  );
  ui.unmount();
});
