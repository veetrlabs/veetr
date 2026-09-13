import { View, Text, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useNavigation } from "./NavigationContext";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function NavigationStatus() {
  const nav = useNavigation(),
    router = useRouter();
  const { theme } = useTheme(),
    c = themeColors[theme];
  return (
    <View
      style={{
        padding: 12,
        gap: 6,
        borderRadius: 12,
        backgroundColor: c.panelBg,
      }}
    >
      <Text style={{ color: c.text, fontWeight: "600" }}>
        {nav.fix?.source ?? "Waiting for GPS"}
        {nav.deviceFresh ? " · Veetr instruments" : " · Phone mode"}
      </Text>
      <Text style={{ color: c.textSecondary }}>
        {nav.session?.phase === "recording"
          ? nav.session.mode === "local"
            ? "Recording locally"
            : "Sharing live"
          : nav.session?.phase === "stopping"
            ? "Recording stopped"
            : "Live display · not recording"}
        {nav.session?.phase === "recording" &&
        nav.session.backgroundEnabled === false
          ? " · Keep app open"
          : ""}
      </Text>
      <View style={{ flexDirection: "row", gap: 20 }}>
        {!nav.permission && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void nav.enableGPS()}
            style={{ paddingVertical: 8 }}
          >
            <Text style={{ color: c.text }}>Enable phone GPS</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/tracking")}
          style={{ paddingVertical: 8 }}
        >
          <Text style={{ color: c.text }}>Recording controls →</Text>
        </Pressable>
      </View>
      {nav.error ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openSettings()}
        >
          <Text style={{ color: c.text }}>{nav.error} Open Settings</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
