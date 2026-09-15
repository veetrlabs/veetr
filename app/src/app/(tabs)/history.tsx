import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { themeColors } from "../../constants/colors";
import RecordingHistory from "../../tracking/PhoneHistory";
export default function HistoryTab() {
  const [range, setRange] = useState(10);
  const { theme } = useTheme(),
    c = themeColors[theme],
    insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 12 }}>
        {[10, 60, 180, 360, 720, 1440].map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: range === m }}
            onPress={() => setRange(m)}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 20,
              backgroundColor: range === m ? "#006b62" : c.chartBg,
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: 12,
                color: range === m ? "white" : c.text,
              }}
            >
              {m < 60 ? `${m}min` : m < 1440 ? `${m / 60}h` : "1d"}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView>
        <RecordingHistory rangeMinutes={range} />
      </ScrollView>
    </View>
  );
}
