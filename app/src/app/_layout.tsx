import AnchorRuntime from "../anchor/AnchorRuntime";
import LanguageProvider from "../i18n/LanguageProvider";
import { NavigationProvider } from "../navigation/NavigationContext";
import TrackingRuntime from "../tracking/TrackingRuntime";
import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { BLEProvider } from "../context/BLEContext";
import OfflineIndicator from "../components/OfflineIndicator";
import { dataStorage } from "../utils/dataStorage";

function AppNavigation() {
  const { theme } = useTheme();
  const statusBarStyle = theme === "dark" ? "light" : "dark";
  return <>
    <StatusBar style={statusBarStyle} />
    <View style={[styles.container, { backgroundColor: themeColors[theme].bg }]}>
      <OfflineIndicator />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  </>;
}

export default function RootLayout() {
  useEffect(() => {
    dataStorage
      .init()
      .then(() => {
        console.log("[DataStorage] Initialized successfully");
      })
      .catch((err) => {
        console.error("[DataStorage] Failed to initialize:", err);
      });
  }, []);

  return (
    <LanguageProvider>
    <ThemeProvider>
      <BLEProvider>
        <NavigationProvider>
          <TrackingRuntime />
          <AnchorRuntime />
          <AppNavigation />
        </NavigationProvider>
      </BLEProvider>
    </ThemeProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
