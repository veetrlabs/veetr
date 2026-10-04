import { Text, View } from "react-native";
import { t, useLanguageRefresh } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import LanguageSettings from "./LanguageSettings";
import ThemeToggle from "./ThemeToggle";

export default function PreferencesSettings() {
  useLanguageRefresh();
  const colors = themeColors[useTheme().theme];

  return (
    <View>
      <LanguageSettings />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 14,
          gap: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 16 }}>{t("Theme")}</Text>
        <ThemeToggle />
      </View>
    </View>
  );
}
