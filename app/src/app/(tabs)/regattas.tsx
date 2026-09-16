import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { themeColors } from "../../constants/colors";
import RegattaBrowser from "../../regattas/RegattaBrowser";
export default function RegattasScreen() {
  const { theme } = useTheme(), c = themeColors[theme];
  return <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
    <RegattaBrowser />
  </SafeAreaView>;
}
