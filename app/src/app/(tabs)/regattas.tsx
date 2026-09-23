import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { themeColors } from "../../constants/colors";
import RaceTrackingCard from "../../tracking/RaceTrackingCard";
import RegattaBrowser from "../../regattas/RegattaBrowser";
export default function RegattasScreen() {
  const { theme } = useTheme(),
    c = themeColors[theme];
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <RaceTrackingCard />
      <RegattaBrowser onShare={() => router.push("/race-phone" as Href)} />
    </SafeAreaView>
  );
}
