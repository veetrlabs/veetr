import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { trackingStore } from "../tracking/database";
import type { Trip } from "../tracking/trip";
import RaceReplay from "../replay/RaceReplay";
export default function RaceReplayPage() {
  const { seriesId, eventId, tripId } = useLocalSearchParams<{
    seriesId: string;
    eventId: string;
    tripId?: string;
  }>();
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [own, setOwn] = useState<Trip>(),
    [loading, setLoading] = useState(!!tripId),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    if (!tripId) {
      setLoading(false);
      return;
    }
    void trackingStore()
      .then((s) => s.localRecordings())
      .then((rows) => {
        if (!alive) return;
        const trip = rows.find((r) => r.session.id === tripId);
        if (!trip)
          throw new Error("Your local recording is no longer available.");
        setOwn(trip);
        setLoading(false);
      })
      .catch(() => {
        if (alive) {
          setError(
            "Your local recording could not be loaded. Reopen this view to retry.",
          );
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [tripId]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: 16 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: c.text, paddingVertical: 8 }}>‹ Back</Text>
        </Pressable>
      </View>
      {loading ? (
        <Text style={{ color: c.text }}>Loading your recording…</Text>
      ) : error ? (
        <Text style={{ color: c.text, padding: 16 }}>{error}</Text>
      ) : seriesId && eventId ? (
        <RaceReplay seriesId={seriesId} eventId={eventId} own={own} />
      ) : (
        <Text style={{ color: c.text }}>Race details are missing.</Text>
      )}
    </SafeAreaView>
  );
}
