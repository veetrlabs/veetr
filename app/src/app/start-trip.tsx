import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackingClient } from "../tracking/client";
import {
  tripBoats,
  setTripSharing,
  type TripVisibility,
  type TripBoat,
} from "../tracking/tripSharing";
import { TripOptions, TripAccountLink } from "../tracking/TripOptions";
import { trackingStore } from "../tracking/database";
import TripBoatPicker from "../tracking/TripBoatPicker";
import { startLocalTracking } from "../tracking/service";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function StartTrip() {
  const c = themeColors[useTheme().theme];
  const [boat, setBoat] = useState<TripBoat>(),
    [title, setTitle] = useState("My sailing trip"),
    [visibility, setVisibility] = useState<TripVisibility>("private"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void (async () => {
      const auth = await trackingClient?.auth.getSession();
      if (!auth?.data.session) return;
      const key = `veetr-last-trip-boat:${auth.data.session.user.id}`;
      const last = await AsyncStorage.getItem(key);
      const boats = await tripBoats();
      if (alive) setBoat(boats.find((b) => b.id === last));
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  async function start() {
    setBusy(true);
    setError("");
    let startedId: string | undefined;
    try {
      if (visibility !== "private") {
        const auth = await trackingClient?.auth.getSession();
        if (!auth?.data.session)
          throw new Error("Sign in before sharing a trip.");
        if (!boat) throw new Error("Choose a boat before sharing.");
      }
      startedId = await startLocalTracking(boat);
      await (
        await trackingStore()
      ).updateTrip(startedId, { tripTitle: title.trim() || "My sailing trip" });
      if (visibility !== "private")
        await setTripSharing(startedId, visibility, title);
      const auth = await trackingClient?.auth.getSession();
      if (boat && auth?.data.session)
        await AsyncStorage.setItem(
          `veetr-last-trip-boat:${auth.data.session.user.id}`,
          boat.id,
        );
      if (visibility === "private") router.back();
      else
        router.replace({
          pathname: "/trip-sharing",
          params: { id: startedId },
        });
    } catch (e) {
      if (startedId) {
        // Recording already started: continue to its controls, never start a duplicate on retry.
        router.replace({
          pathname: "/trip-sharing",
          params: { id: startedId },
        });
      } else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: c.text }}>‹ Trips</Text>
        </Pressable>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: "700" }}>
          Start a trip
        </Text>
        <Text style={{ color: c.textMuted }}>
          Choose your boat and who can watch. Private trips stay on this device.
        </Text>
        <TripBoatPicker selected={boat?.id} onSelect={setBoat} />
        <TripOptions
          title={title}
          onTitle={setTitle}
          visibility={visibility}
          onVisibility={setVisibility}
          disabled={busy}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy || (visibility !== "private" && !boat)}
          onPress={() => void start()}
          style={{
            padding: 16,
            minHeight: 48,
            backgroundColor: "#006b62",
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>
            {busy
              ? "Starting…"
              : visibility === "private"
                ? "Start private recording"
                : visibility === "public"
                  ? "Start recording · share publicly"
                  : "Start recording · share by link"}
          </Text>
        </Pressable>
        <TripAccountLink />
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {error}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
