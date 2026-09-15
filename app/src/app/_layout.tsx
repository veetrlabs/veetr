import { NavigationProvider } from "../navigation/NavigationContext";
import TrackingRuntime from "../tracking/TrackingRuntime";
import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "../context/ThemeContext";
import { BLEProvider } from "../context/BLEContext";
import OfflineIndicator from "../components/OfflineIndicator";
import { dataStorage } from "../utils/dataStorage";

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
    <ThemeProvider>
      <BLEProvider>
        <NavigationProvider>
          <TrackingRuntime />
          <StatusBar style="auto" />
          <View style={styles.container}>
            <OfflineIndicator />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </View>
        </NavigationProvider>
      </BLEProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
