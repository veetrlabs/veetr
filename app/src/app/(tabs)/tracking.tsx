import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { themeColors } from "../../constants/colors";
import { trackingStore } from "../../tracking/database";
import type { TrackingSession } from "../../tracking/model";
import LocalRecording from "../../tracking/LocalRecording";
import TripMap from "../../tracking/TripMap";
import RaceTrackingCard from "../../tracking/RaceTrackingCard";
import TrackingIcon from "../../tracking/TrackingIcon";
import {
  distanceNm,
  durationLabel,
  orderedPoints,
  tripDuration,
  type Trip,
} from "../../tracking/trip";
export default function TrackingScreen() {
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [session, setSession] = useState<TrackingSession | null>(null),
    [trips, setTrips] = useState<Trip[]>([]),
    [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const store = await trackingStore();
    const [current, rows] = await Promise.all([
      store.get(),
      store.localRecordings(),
    ]);
    setSession(current);
    setTrips(rows.map((r) => ({ ...r, points: orderedPoints(r.points) })));
    setNow(Date.now());
    setLoading(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const update = () => {
        if (alive)
          void refresh().catch((e) => {
            if (alive) {
              setError(String(e));
              setLoading(false);
            }
          });
      };
      update();
      const timer = setInterval(update, 5000);
      const clock = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        alive = false;
        clearInterval(timer);
        clearInterval(clock);
      };
    }, [refresh]),
  );
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const current = trips.find((t) => t.session.id === session?.id);
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={trips}
        keyExtractor={(t) => t.session.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        initialNumToRender={4}
        windowSize={5}
        refreshing={loading}
        onRefresh={() => void refresh().catch((e) => setError(String(e)))}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 2 }}>
            {!session || session.mode === "local" ? (
              <LocalRecording
                session={session}
                count={current?.points.length || 0}
                now={now}
                busy={busy}
                run={run}
              />
            ) : session.mode === "race" ? (
              <RaceTrackingCard />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/regattas")}
                style={{
                  padding: 18,
                  backgroundColor: c.panelBg,
                  borderRadius: 16,
                }}
              >
                <Text style={{ color: c.text }}>
                  Race tracking · manage in Races ›
                </Text>
              </Pressable>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={{ color: c.text }}>
                {error}
              </Text>
            )}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 10,
              }}
            >
              <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>
                Your trips
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>
                {trips.length} saved
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ padding: 30, alignItems: "center", gap: 10 }}>
            <TrackingIcon name="route" color={c.textMuted} size={32} />
            <Text style={{ color: c.text, fontWeight: "600" }}>
              {loading ? "Loading trips…" : "Your next trip starts here"}
            </Text>
            <Text
              style={{
                color: c.textMuted,
                textAlign: "center",
                lineHeight: 21,
              }}
            >
              Record a sail to keep its route, distance and speed together.
            </Text>
          </View>
        }
        renderItem={({ item: trip }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Trip ${new Date(trip.session.startedAt).toLocaleString()}, ${distanceNm(trip.points).toFixed(2)} nautical miles, ${durationLabel(tripDuration(trip, now))}`}
            onPress={() =>
              router.push({
                pathname: "/trip/[id]",
                params: { id: trip.session.id },
              })
            }
            style={{
              backgroundColor: c.panelBg,
              borderRadius: 16,
              overflow: "hidden",
              flexDirection: "row",
              minHeight: 108,
            }}
          >
            <View pointerEvents="none" style={{ width: 104, minHeight: 108 }}>
              <TripMap points={trip.points} thumbnail />
            </View>
            <View
              style={{ flex: 1, padding: 13, gap: 7, justifyContent: "center" }}
            >
              <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>
                {trip.session.mode === 'race' ? `${trip.session.raceName || trip.session.seriesName} · ${trip.session.boatName}` : new Date(trip.session.startedAt).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric", year: "numeric" },
                )}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                {new Date(trip.session.startedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {trip.session.phase === "recording" ? "  ·  ● Recording" : ""}
              </Text>
              <Text style={{ color: c.text, fontSize: 14 }}>
                {distanceNm(trip.points).toFixed(2)} nm ·{" "}
                {durationLabel(tripDuration(trip, now))}
              </Text>
            </View>
            <View style={{ justifyContent: "center", paddingRight: 12 }}>
              <TrackingIcon name="chevron" color={c.textMuted} size={16} />
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
