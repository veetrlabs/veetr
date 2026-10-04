import { t, useLanguageRefresh, type LanguagePreference } from "../i18n";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { useLanguagePreference } from "../i18n/LanguageProvider";

export default function LanguageSettings() {
  useLanguageRefresh();
  const { preference, setPreference } = useLanguagePreference();
  const colors = themeColors[useTheme().theme];
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const options: [LanguagePreference, string][] = [
    ["system", t("System default")],
    ["en", "English"],
    ["cs", "Čeština"],
  ];
  async function select(value: LanguagePreference) {
    setSaving(true);
    setFailed(false);
    try {
      await setPreference(value);
      setExpanded(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <View style={{ paddingVertical: 14, gap: 8 }}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}
      >
        {t("Language")}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Language")}
        accessibilityState={{ expanded, disabled: saving }} disabled={saving}
        onPress={() => setExpanded(!expanded)}
        style={{ minHeight: 48, padding: 12, borderRadius: 8, backgroundColor: colors.buttonBg, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: colors.text, flex: 1, fontSize: 16 }}>{options.find(([value]) => value === preference)?.[1]}</Text>
        <Text style={{ color: colors.text }} accessibilityElementsHidden>{expanded ? '▴' : '▾'}</Text>
      </Pressable>
      {expanded && <View
        accessibilityRole="radiogroup"
        style={{ gap: 4 }}
      >
        {options.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{
              checked: preference === value,
              disabled: saving,
            }}
            disabled={saving}
            onPress={() => void select(value)}
            style={{
              minHeight: 44,
              padding: 12,
              borderRadius: 8,
              backgroundColor: colors.buttonBg,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text style={{ color: colors.text, flex: 1, fontSize: 16 }}>
              {label}
            </Text>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{ color: colors.text }}
            >
              {preference === value ? "✓" : ""}
            </Text>
          </Pressable>
        ))}
      </View>}
      <Text style={{ color: colors.textSecondary }}>
        {t(
          "System default follows your phone’s preferred supported language. Otherwise, English is used.",
        )}
      </Text>
      {failed && (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {t("Could not save your choice. Please try again.")}
        </Text>
      )}
    </View>
  );
}
