import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function RaceBoatPreview({
  boatId,
  boatName,
}: {
  boatId: string;
  boatName: string;
}) {
  const c = themeColors[useTheme().theme];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/my-boats",
          params: { raceBoatId: boatId, boatName },
        })
      }
      style={({ pressed }) => ({
        padding: 16,
        minHeight: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.buttonBg,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>
        {boatName} ›
      </Text>
    </Pressable>
  );
}
