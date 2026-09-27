import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, AppState, Platform } from "react-native";
import { confirmTrackingLocationUse } from "../locationDisclosure";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(), setItem: jest.fn(async () => {}),
}));
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  AppState: { currentState: "active" },
  Platform: { OS: "android" },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = "android";
  (AppState as { currentState: string }).currentState = "active";
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

test("waits for affirmative consent and only then remembers it", async () => {
  const pending = confirmTrackingLocationUse();
  await Promise.resolve();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  const [, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
  expect(message).toContain("even when the app is closed or not in use");
  expect(message).toContain("sent to Veetr");
  buttons.find((button: { text: string }) => button.text === "Continue").onPress();
  await pending;
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.any(String), "accepted");
});

test.each(["cancel", "dismiss"])("%s does not grant consent", async (action) => {
  const pending = confirmTrackingLocationUse();
  const rejected = expect(pending).rejects.toThrow("not started");
  await Promise.resolve();
  const [, , buttons, options] = (Alert.alert as jest.Mock).mock.calls[0];
  if (action === "cancel") buttons[0].onPress();
  else options.onDismiss();
  await rejected;
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test("does not show a dialog for already accepted disclosure or on iOS", async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue("accepted");
  await confirmTrackingLocationUse();
  (Platform as { OS: string }).OS = "ios";
  await confirmTrackingLocationUse();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test("does not prompt from the background", async () => {
  (AppState as { currentState: string }).currentState = "background";
  await expect(confirmTrackingLocationUse()).rejects.toThrow("Open Veetr");
  expect(Alert.alert).not.toHaveBeenCalled();
});
