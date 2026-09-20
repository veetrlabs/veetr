import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, Text } from "react-native";
import { router, type Href } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { themeColors } from "../../constants/colors";
import RegattaBrowser from "../../regattas/RegattaBrowser";
export default function RegattasScreen() {
  const { theme } = useTheme(),
    c = themeColors[theme];
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/race-phone" as Href)}
        style={{ padding: 16 }}
      >
        <Text style={{ color: c.text, fontWeight: "600" }}>
          My race phone · readiness & sharing →
        </Text>
      </Pressable>
      <RegattaBrowser onShare={() => router.push("/regatta-sharing")} />
    </SafeAreaView>
  );
}
