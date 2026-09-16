import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useTheme } from "../../context/ThemeContext";
import { themeColors } from "../../constants/colors";
import { trackingStore } from "../../tracking/database";
import { discardStoppedTracking } from "../../tracking/service";
import {
  distanceNm,
  durationLabel,
  orderedPoints,
  tripDuration,
  type Trip,
} from "../../tracking/trip";
import TripMap from "../../tracking/TripMap";
import TripChart from "../../tracking/TripChart";
export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { theme } = useTheme(),
    c = themeColors[theme],
    { height } = useWindowDimensions();
  const [trip, setTrip] = useState<Trip | null>(null),
    [index, setIndex] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [scrubbing, setScrubbing] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const refresh = async () => {
        try {
          const records = await (await trackingStore()).localRecordings();
          if (alive) {
            const record = records.find((r) => r.session.id === id);
            setTrip((previous) => {
              const next = record
                ? { ...record, points: orderedPoints(record.points) }
                : null;
              return JSON.stringify(previous) === JSON.stringify(next)
                ? previous
                : next;
            });
            setLoading(false);
          }
        } catch (e) {
          if (alive) {
            setError(String(e));
            setLoading(false);
          }
        }
      };
      void refresh();
      const timer = setInterval(() => void refresh(), 5000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [id]),
  );
  async function exportTrip() {
    if (!trip) return;
    setBusy(true);
    let file: File | undefined;
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Sharing is unavailable on this device.");
      file = new File(Paths.cache, `veetr-trip-${trip.session.id}.json`);
      file.write(JSON.stringify(trip, null, 2));
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        UTI: "public.json",
      });
    } catch (e) {
      setError(String(e));
    } finally {
      if (file?.exists) file.delete();
      setBusy(false);
    }
  }
  function deleteTrip() {
    if (!trip) return;
    Alert.alert(
      "Delete trip?",
      "This permanently removes this trip from your phone. Export it first to keep a copy.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            void (async () => {
              const store = await trackingStore();
              if (trip.archived)
                await store.deleteArchivedLocal(trip.session.id);
              else {
                const current = await store.get();
                if (current?.id !== trip.session.id)
                  throw new Error(
                    "This trip changed. Reopen it before deleting.",
                  );
                await discardStoppedTracking();
              }
              router.back();
            })()
              .catch((e) => setError(String(e)))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ paddingVertical: 10, paddingRight: 10 }}
        >
          <Text style={{ color: "#008c80", fontSize: 16 }}>‹ Trips</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: "600", fontSize: 16 }}>
            {trip
              ? new Date(trip.session.startedAt).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Trip"}
          </Text>
          {trip && (
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 3 }}>
              {distanceNm(trip.points).toFixed(2)} nm ·{" "}
              {durationLabel(tripDuration(trip))}
              {trip.session.phase === "recording" ? " · Recording" : ""}
            </Text>
          )}
        </View>
      </View>
      {trip ? (
        <ScrollView
          scrollEnabled={!scrubbing}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View
            style={{
              height: Math.max(200, Math.min(340, height * 0.35)),
              marginHorizontal: 16,
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            <TripMap points={trip.points} selected={trip.points[index]} />
          </View>
          <View style={{ padding: 20, gap: 24 }}>
            <TripChart
              points={trip.points}
              index={index}
              onSelect={setIndex}
              onScrubbing={setScrubbing}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                onPress={() => void exportTrip()}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: c.buttonBg,
                }}
              >
                <Text style={{ color: c.text, textAlign: "center" }}>
                  Export trip
                </Text>
              </Pressable>
              {trip.session.phase === "stopping" && (
                <Pressable
                  disabled={busy}
                  accessibilityRole="button"
                  onPress={deleteTrip}
                  style={{ padding: 14 }}
                >
                  <Text style={{ color: "#c45c55" }}>Delete trip</Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      ) : (
        <Text style={{ padding: 24, color: c.textMuted }}>
          {loading ? "Loading trip…" : "This trip is no longer available."}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: c.text, padding: 16 }}>
          {error}
        </Text>
      )}
    </SafeAreaView>
  );
}
