import { requestNorthAlignment, northResultMessage } from '../../utils/northAlignment';
import { t, useLanguageRefresh } from '../../i18n';
import AnchorSettings from "../../anchor/AnchorSettings";
import PreferencesSettings from "../../components/PreferencesSettings";
import AccountSettings from "../../components/AccountSettings";
import LocationSettings from "../../tracking/LocationSettings";
import CalibrationControls from "../../components/CalibrationControls";
import QuickGuide from "../../components/QuickGuide";
import RegattaSettings from "../../components/RegattaSettings";
import BluetoothSettings from "../../components/BluetoothSettings";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { themeColors } from "../../constants/colors";
import { useBLE } from "../../context/BLEContext";
import { APP_VERSION } from "../../utils/version";

type ViewType =
  | "anchor"
  | "preferences"
  | "account"
  | "location"
  | "guide"
  | "bluetooth"
  | "main"
  | "regatta"
  | "calibration";

export default function SettingsTab() {
  useLanguageRefresh();
  const insets = useSafeAreaInsets();
  const [currentView, setCurrentView] = useState<ViewType>("main");
  useFocusEffect(useCallback(() => {
    setCurrentView("main");
  }, []));
  const { state, sendCommand } = useBLE();
  const { theme } = useTheme();
  const colors = themeColors[theme];

  const navigateTo = (view: ViewType) => setCurrentView(view);

  const handleCalibrateLevel = () => {
    if (!state.isConnected) {
      Alert.alert(t("Not Connected"), t("Please connect to Veetr Vane first"));
      return;
    }
    Alert.alert(
      t("Calibrate Level"),
      t("This will set the current orientation as level (0°) across all axes."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Calibrate"),
          onPress: async () => {
            const success = await sendCommand({ action: "resetHeelAngle" });
            Alert.alert(
              success ? t("Success") : t("Failed"),
              success
                ? t("Vessel level calibration completed!")
                : t("Failed to calibrate."),
            );
          },
        },
      ],
    );
  };

  const handleCalibrateCompass = () => {
    if (!state.isConnected) {
      Alert.alert(t("Not Connected"), t("Please connect to Veetr Vane first"));
      return;
    }
    Alert.alert(t("Calibrate Compass"), t("Point the vessel's bow toward north."), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Calibrate"),
        onPress: async () => {
          const result = await requestNorthAlignment(sendCommand);
          Alert.alert(t(result === 'accepted' ? 'Success' : 'Compass reference'), t(northResultMessage[result]));
        },
      },
    ]);
  };

  const renderMain = () => (
    <>
      <Text style={[styles.pageTitle, { color: colors.text }]}>{t("Settings")}</Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("Veetr Account")}
        style={[styles.menuItem, { borderBottomColor: colors.border }]}
        onPress={() => navigateTo("account")}
      >
        <Text style={[styles.menuItemText, { color: colors.text }]}>
          {t("Veetr Account")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("Bluetooth settings")}
        style={[styles.menuItem, { borderBottomColor: colors.border }]}
        onPress={() => navigateTo("bluetooth")}
      >
        <Text style={[styles.menuItemText, { color: colors.text }]}>
          {t("Bluetooth settings")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("Race Start Line")}
        style={[styles.menuItem, { borderBottomColor: colors.border }]}
        onPress={() => navigateTo("regatta")}
      >
        <Text style={[styles.menuItemText, { color: colors.text }]}>
          {t("Race Start Line")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.menuItem, { borderBottomColor: colors.border }]}
        onPress={() => navigateTo("calibration")}
      >
        <Text style={[styles.menuItemText, { color: colors.text }]}>
          {t("Calibration")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>


      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("Quick guide")}
        style={[styles.menuItem, { borderBottomColor: colors.border }]}
        onPress={() => navigateTo("guide")}
      >
        <Text style={[styles.menuItemText, { color: colors.text }]}>
          {t("Quick guide")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("Location and tracking settings")}
        style={[styles.menuItem, { borderBottomColor: colors.border }]}
        onPress={() => navigateTo("location")}
      >
        <Text style={[styles.menuItemText, { color: colors.text }]}>
          {t("Location & tracking")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("Preferences")}
        style={[styles.menuItem, { borderBottomColor: colors.border }]}
        onPress={() => navigateTo("preferences")}
      >
        <Text style={[styles.menuItemText, { color: colors.text }]}>
          {t("Preferences")}
        </Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Anchor alarm")}
        style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo("anchor")}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>{t("Anchor alarm")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>
      <Text style={[styles.version, { color: colors.textSubtle }]}>
        {t("App Version:")} {APP_VERSION}
      </Text>
    </>
  );

  const renderCalibration = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigateTo("main")}>
          <Text style={styles.back}>{t("‹ Back")}</Text>
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.text }]}>
          {t("Calibration")}</Text>
        <View style={{ width: 50 }} />
      </View>

      <CalibrationControls
        connected={state.isConnected && !state.isConnecting}
        onLevel={handleCalibrateLevel}
        onNorth={handleCalibrateCompass}
      />
    </>
  );

  if (currentView === "anchor") return <AnchorSettings onBack={() => navigateTo("main")} />;

  if (currentView === "account")
    return <AccountSettings onBack={() => navigateTo("main")} />;

  if (currentView === "guide")
    return <QuickGuide onBack={() => navigateTo("main")} />;

  if (currentView === "regatta")
    return (
      <RegattaSettings
        onBack={() => navigateTo("main")}
        onBluetooth={() => navigateTo("bluetooth")}
      />
    );

  if (currentView === "bluetooth")
    return <BluetoothSettings onBack={() => navigateTo("main")} />;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: insets.top + 8 },
      ]}
    >
      <ScrollView key={currentView} contentContainerStyle={styles.scrollContent}>
        {currentView === "preferences" && (
          <>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigateTo("main")}
            >
              <Text style={styles.back}>{t("‹ Settings")}</Text>
            </TouchableOpacity>
            <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>
              {t("Preferences")}
            </Text>
            <PreferencesSettings />
          </>
        )}
        {currentView === "location" && (
          <>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigateTo("main")}
            >
              <Text style={styles.back}>{t("‹ Settings")}</Text>
            </TouchableOpacity>
            <LocationSettings />

          </>
        )}
        {currentView === "main" && renderMain()}
        {currentView === "calibration" && renderCalibration()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 32 },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  back: {
    fontSize: 16,
    color: "#3182ce",
    fontWeight: "600",
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuItemText: { fontSize: 16 },
  arrow: { fontSize: 22 },

  version: { fontSize: 14, textAlign: "center", marginTop: 16 },
});
