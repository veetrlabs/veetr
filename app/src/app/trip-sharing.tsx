import { useCallback, useState } from "react";
import { Pressable, ScrollView, Share, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { trackingStore } from "../tracking/database";
import {
  selectTripBoat,
  setTripSharing,
  syncSharedTrip,
  tripLink,
  type TripVisibility,
} from "../tracking/tripSharing";
import { TripOptions, TripAccountLink } from "../tracking/TripOptions";
import TripBoatPicker from "../tracking/TripBoatPicker";
import type { Trip } from "../tracking/trip";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function TripSharingPage() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    c = themeColors[useTheme().theme];
  const [trip, setTrip] = useState<Trip>(),
    [title, setTitle] = useState(""),
    [visibility, setVisibility] = useState<TripVisibility>("private"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const t = (await (await trackingStore()).localRecordings()).find(
      (t) => t.session.id === id,
    );
    setTrip(t);
    return t;
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void refresh()
        .then((t) => {
          if (alive) {
            setTitle(
              t?.session.sharing?.title ??
                t?.session.tripTitle ??
                "My sailing trip",
            );
            setVisibility(
              t?.session.sharing?.pendingVisibility ??
                t?.session.sharing?.visibility ??
                "private",
            );
          }
        })
        .catch((e) => setError(String(e)));
      const timer = setInterval(
        () => void refresh().catch((e) => setError(String(e))),
        5000,
      );
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [refresh]),
  );
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  const sh = trip?.session.sharing,
    active = trip?.session.phase === "recording",
    shared = sh && sh.visibility !== "private";
  const button = {
    padding: 16,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: c.buttonBg,
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: c.text }}>‹ Back to trip</Text>
        </Pressable>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: "700" }}>
          {active ? "Share live" : "Share trip"}
        </Text>
        {!trip ||
        (trip.session.mode !== "local" && trip.session.phase !== "stopping") ? (
          <Text style={{ color: c.text }}>
            Choose a personal trip to share.
          </Text>
        ) : (
          <>
            <Text style={{ color: c.textMuted }}>
              Share this trip’s route and recorded instruments. Anyone with the
              link can view it without signing in. Public trips also appear in
              Explore trips.
            </Text>
            {sh || trip.session.mode !== "local" ? (
              <Text style={{ color: c.text }}>{trip.session.boatName}</Text>
            ) : (
              <TripBoatPicker
                selected={trip.session.boatId}
                onSelect={(b) => void run(() => selectTripBoat(id, b))}
              />
            )}
            <TripOptions
              title={title}
              onTitle={setTitle}
              visibility={visibility}
              onVisibility={setVisibility}
              disabled={busy}
            />
            <Pressable
              accessibilityRole="button"
              disabled={
                busy || (visibility !== "private" && !trip.session.boatId)
              }
              style={{ ...button, backgroundColor: "#006b62" }}
              onPress={() =>
                void run(async () => {
                  await (
                    await trackingStore()
                  ).updateTrip(id, {
                    tripTitle: title.trim() || "My sailing trip",
                  });
                  if (visibility !== "private" || sh)
                    await setTripSharing(id, visibility, title);
                })
              }
            >
              <Text style={{ color: "white" }}>
                {busy
                  ? "Working…"
                  : visibility === "private"
                    ? shared
                      ? "Stop sharing and disable link"
                      : "Save private trip"
                    : active
                      ? "Start / update live sharing"
                      : "Publish trip"}
              </Text>
            </Pressable>
            {sh?.pendingVisibility && (
              <Text accessibilityLiveRegion="polite" style={{ color: c.text }}>
                {sh.pendingVisibility === "private"
                  ? "Stopping sharing—waiting for server confirmation. The link may still be visible until connected."
                  : !trip.points.length
                    ? "Waiting for the first GPS position to start sharing…"
                    : "Uploading trip before publishing…"}
              </Text>
            )}
            {shared && !sh?.pendingVisibility && (
              <>
                <Text style={{ color: "#008c80", fontWeight: "700" }}>
                  {active ? "● Sharing live" : "Published"} ·{" "}
                  {sh.visibility === "public"
                    ? "Public"
                    : "Anyone with the link"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={button}
                  onPress={() =>
                    void Share.share({
                      message: tripLink(sh.token!),
                      url: tripLink(sh.token!),
                    })
                  }
                >
                  <Text style={{ color: c.text }}>Share link</Text>
                </Pressable>
              </>
            )}
            {(shared || sh?.pendingVisibility) && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={button}
                onPress={() =>
                  void run(() => setTripSharing(id, "private", title))
                }
              >
                <Text style={{ color: c.text }}>
                  Stop sharing and disable link
                </Text>
              </Pressable>
            )}
            {sh?.error && (
              <>
                <Text accessibilityRole="alert" style={{ color: c.text }}>
                  {sh.error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={button}
                  disabled={busy}
                  onPress={() => void run(() => syncSharedTrip(id))}
                >
                  <Text style={{ color: c.text }}>Retry sync</Text>
                </Pressable>
              </>
            )}
          </>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {error}
          </Text>
        )}
        <TripAccountLink />
      </ScrollView>
    </SafeAreaView>
  );
}
