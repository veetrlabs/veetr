import { Pressable, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { useRaceTracking } from "./useRaceTracking";
import { raceTrackingStatus } from "./raceTrackingStatus";
export default function RaceTrackingCard({
  showMap = true,
}: {
  showMap?: boolean;
}) {
  const { session, phone, now } = useRaceTracking();
  if (session?.mode !== "race" && !phone) return null;
  const status = raceTrackingStatus(session, now);
  return (
    <View
      style={{
        padding: 16,
        margin: 12,
        borderRadius: 16,
        backgroundColor: status.live ? "#005b50" : "#263c54",
        borderWidth: 2,
        borderColor: status.live ? "#55d8b0" : "#a5c9eb",
        gap: 8,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ color: "white", fontWeight: "800", fontSize: 20 }}
      >
        {status.live ? "● " : ""}
        {status.label}
      </Text>
      <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
        {session?.mode === "race"
          ? `${session.boatName} · ${session.raceName}`
          : phone
            ? `${phone.boatName} · ${phone.raceName}`
            : ""}
      </Text>
      <Text style={{ color: "#e0edf5" }}>{status.detail}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {showMap && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/map")}
            style={{
              backgroundColor: "white",
              padding: 12,
              borderRadius: 10,
              minHeight: 44,
            }}
          >
            <Text style={{ color: "#15364a", fontWeight: "700" }}>
              View race map
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/race-phone" as Href)}
          style={{
            borderColor: "white",
            borderWidth: 1,
            padding: 12,
            borderRadius: 10,
            minHeight: 44,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>
            Manage tracking
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
