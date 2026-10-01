import React, { useEffect, useState } from "react";
import { Text, Pressable } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LanguageProvider from "../LanguageProvider";
import LanguageSettings from "../../components/LanguageSettings";
import { i18n, LANGUAGE_STORAGE_KEY, t, useLanguageRefresh } from "../index";

let mockLocales = [{ languageTag: "cs-CZ" }];
let mockForeground: (state: string) => void;
const mockRemove = jest.fn();
const mockMount = jest.fn();
jest.mock("expo-localization", () => ({ getLocales: () => mockLocales }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
jest.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  Pressable: "Pressable",
  AppState: {
    addEventListener: (_: string, cb: typeof mockForeground) => {
      mockForeground = cb;
      return { remove: mockRemove };
    },
  },
  StyleSheet: { flatten: (style: unknown) => style },
}));
function ActiveScreen() {
  useLanguageRefresh();
  const [count, setCount] = useState(0);
  useEffect(() => {
    mockMount();
  }, []);
  return (
    <>
      <Text>{t("Settings")}</Text>
      <Pressable
        accessibilityLabel="increment"
        onPress={() => setCount((v) => v + 1)}
      >
        <Text>{String(count)}</Text>
      </Pressable>
      <LanguageSettings />
    </>
  );
}
beforeEach(async () => {
  jest.clearAllMocks();
  mockLocales = [{ languageTag: "cs-CZ" }];
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  await i18n.changeLanguage("en");
});

test("first launch uses Czech; switching persists without remounting active screens", async () => {
  const view = render(
    <LanguageProvider>
      <ActiveScreen />
    </LanguageProvider>,
  );
  expect(await view.findByText("Nastavení")).toBeTruthy();
  fireEvent.press(view.getByLabelText("increment"));
  fireEvent.press(view.getByLabelText("Jazyk"));
  fireEvent.press(view.getByLabelText("English"));
  expect(await view.findByText("Settings")).toBeTruthy();
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY, "en");
  expect(view.getByText("1")).toBeTruthy();
  expect(mockMount).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(mockRemove).toHaveBeenCalled();
});

test("saved choice overrides phone and system mode follows changes on foreground", async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue("en");
  const view = render(
    <LanguageProvider>
      <ActiveScreen />
    </LanguageProvider>,
  );
  expect(await view.findByText("Settings")).toBeTruthy();
  await act(async () => mockForeground("active"));
  expect(view.getByText("Settings")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Language"));
  fireEvent.press(view.getByLabelText("System default"));
  expect(await view.findByText("Nastavení")).toBeTruthy();
  mockLocales = [{ languageTag: "hr-HR" }];
  await act(async () => mockForeground("active"));
  expect(await view.findByText("Settings")).toBeTruthy();
  view.unmount();
});

test("storage failures preserve a usable app and do not claim the preference was saved", async () => {
  (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error("storage"));
  (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error("storage"));
  const view = render(
    <LanguageProvider>
      <ActiveScreen />
    </LanguageProvider>,
  );
  await view.findByText("Nastavení");
  fireEvent.press(view.getByLabelText("Jazyk"));
  fireEvent.press(view.getByLabelText("English"));
  await waitFor(() =>
    expect(
      view.getByText("Volbu se nepodařilo uložit. Zkuste to znovu."),
    ).toBeTruthy(),
  );
  expect(view.getByText("Nastavení")).toBeTruthy();
  view.unmount();
});
