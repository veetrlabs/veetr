import { Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "../navigation/NavigationContext";
import NavigationStatus from "../navigation/NavigationStatus";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useBLE } from "../context/BLEContext";
import SpeedCard from "./cards/SpeedCard";
import WindCard from "./cards/WindCard";
import TiltCard from "./cards/TiltCard";
import ApparentAngleCard from "./cards/ApparentAngleCard";
import TrueWindAngleCard from "./cards/TrueWindAngleCard";
import WindAngleCard from "./cards/WindAngleCard";
import StartingLineCard from "./cards/StartingLineCard";
import HeadingCard from "./cards/HeadingCard";

export default function Dashboard() {
  const nav = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = themeColors[theme];
  const { state } = useBLE();
  const { sailingData } = state;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  if (!nav.deviceFresh)
    return (
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: insets.top + 80,
          gap: 16,
          paddingBottom: 100,
        }}
      >
        <NavigationStatus />
        <View style={{ height: 180, flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <SpeedCard speed={nav.fix?.sogKnots ?? null} />
          </View>
          <View style={{ flex: 1 }}>
            <HeadingCard heading={nav.fix?.course ?? null} title="COG" />
          </View>
        </View>
        <Text style={{ color: colors.textSecondary }}>
          Course over ground is your direction of travel, not compass heading.
          Speed and course need a recent GPS fix.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/map")}
          style={{
            padding: 16,
            backgroundColor: colors.buttonBg,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: colors.text }}>
            View position and track on map →
          </Text>
        </Pressable>
        <View
          style={{
            padding: 20,
            gap: 10,
            backgroundColor: colors.cardBg,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600" }}>
            Add Veetr instruments
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Wind speed and angles, compass heading, heel and start-line
            instruments require data from a connected Veetr device.
          </Text>
        </View>
      </ScrollView>
    );
  const compass = (
    <WindAngleCard
      windDirection={sailingData.windDirection}
      trueWindSpeed={sailingData.trueWindSpeed}
      trueWindAngle={sailingData.trueWindAngle}
      deadWindAngle={sailingData.deadWindAngle}
      heading={sailingData.heading}
    />
  );

  const cardRows = (
    <>
      <View style={styles.cardRow}>
        <View style={styles.cardCell}>
          <WindCard windSpeed={sailingData.windSpeed} title="Apparent Wind" />
        </View>
        <View style={styles.cardCell}>
          <ApparentAngleCard awa={sailingData.windAngle} />
        </View>
      </View>
      <View style={styles.cardRow}>
        <View style={styles.cardCell}>
          <WindCard windSpeed={sailingData.trueWindSpeed} title="True Wind" />
        </View>
        <View style={styles.cardCell}>
          <TrueWindAngleCard twa={sailingData.trueWindAngle} />
        </View>
      </View>
      <View style={styles.cardRow}>
        <View style={styles.cardCell}>
          <SpeedCard speed={nav.fix?.sogKnots ?? null} />
        </View>
        <View style={styles.cardCell}>
          <HeadingCard heading={sailingData.heading} />
        </View>
      </View>
      <View style={styles.cardRow}>
        <View style={styles.cardCell}>
          <StartingLineCard
            hasStartLine={sailingData.hasStartLine}
            distanceToLine={sailingData.distanceToLine}
          />
        </View>
        <View style={styles.cardCell}>
          <TiltCard tilt={sailingData.tilt} />
        </View>
      </View>
    </>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View style={{ marginTop: insets.top + 72, marginHorizontal: 8 }}>
        <NavigationStatus />
      </View>
      {isLandscape ? (
        <View style={styles.landscapeWrap}>
          <View style={styles.compassColumn}>
            <View style={styles.compassWrapper}>{compass}</View>
          </View>
          <View style={styles.cardsColumn}>{cardRows}</View>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.compassSection}>{compass}</View>
          <View style={styles.cardsGrid}>{cardRows}</View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    padding: 8,
    paddingBottom: 100,
  },
  compassSection: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    aspectRatio: 1,
    marginBottom: 12,
  },
  cardsGrid: {
    flex: 1,
    gap: 8,
  },
  landscapeWrap: {
    flex: 1,
    flexDirection: "row",
    padding: 8,
    gap: 8,
  },
  compassColumn: {
    flex: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  compassWrapper: {
    width: "100%",
    maxWidth: 400,
    aspectRatio: 1,
  },
  cardsColumn: {
    flex: 3,
    gap: 8,
  },
  cardRow: {
    minHeight: 90,
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  cardCell: {
    flex: 1,
  },
});
