import type { MapRegion } from "../../maps/headingRay";
import { formatNumber, locale, translateMessage, t, useLanguageRefresh } from '../../i18n';
import { errorOccurredAt } from "../../tracking/errorHistory";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
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
import { recordingStatus } from "../../tracking/recordingStatus";
import { trackingErrorMessage } from "../../tracking/errorMessage";
export default function TripDetail() {
  useLanguageRefresh();
  const { id } = useLocalSearchParams<{ id: string }>(),
    { theme } = useTheme(),
    c = themeColors[theme],
    { height } = useWindowDimensions();
  const [trip, setTrip] = useState<Trip | null>(null),
    [now, setNow] = useState(Date.now()),
    [index, setIndex] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [scrubbing, setScrubbing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chartFollowsMap, setChartFollowsMap] = useState(true);
  const [mapRegion, setMapRegion] = useState<MapRegion>();
  const [fitRequest, setFitRequest] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      let archived = false;
      const refresh = async () => {
        try {
          const record = await (await trackingStore()).localRecording(id);
          if (alive) {
            setNow(Date.now());
            archived = !!record?.archived;
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
      const timer = setInterval(() => { if (!archived) void refresh(); }, 5000);
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
    if (trip.session.sharing && (trip.session.sharing.visibility!=="private" || trip.session.sharing.pendingVisibility)) { setError("Stop sharing in the sharing page before deleting this trip."); return; }
    Alert.alert(
      t("Delete from this phone?"),
      t("This removes your personal copy from this phone. It does not delete the official race history. Export first to keep a copy."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
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
  const warning = trackingErrorMessage(trip?.session.error || trip?.session.lastTaskError, trip ? errorOccurredAt(trip.session) : undefined);
  const distance = useMemo(() => trip ? distanceNm(trip.points) : 0, [trip?.points]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          zIndex: 10,
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
          <Text style={{ color: "#008c80", fontSize: 16 }}>{t("‹ Trips")}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: "600", fontSize: 16 }}>
            {trip
              ? new Date(trip.session.startedAt).toLocaleDateString(locale(), {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : t("Trip")}
          </Text>
          {trip && (
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 3 }}>
              {formatNumber(distance, 2)} nm ·{" "}
              {durationLabel(tripDuration(trip))}
              {trip.session.phase === "recording" ? ` · ${recordingStatus(trip.session, now)}` : ""}
            </Text>
          )}
        </View>
        {trip && <View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Trip options")}
            accessibilityState={{ expanded: menuOpen, disabled: busy }} disabled={busy}
            onPress={() => setMenuOpen(open => !open)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <View accessible={false} style={{ gap: 4 }}>
              {[0, 1, 2].map(line => <View key={line} style={{ width: 22, height: 2, borderRadius: 1, backgroundColor: c.text }} />)}
            </View>
          </Pressable>
        </View>}
      </View>
      {trip && menuOpen && <View accessibilityLabel={t("Trip options")} onAccessibilityEscape={() => setMenuOpen(false)}
        style={{ marginHorizontal: 16, marginBottom: 12, alignSelf: 'flex-end', width: 260, padding: 6, borderRadius: 14, backgroundColor: c.panelBg }}>
        {(trip.session.mode === "local" || trip.session.phase === "stopping") && <Pressable accessibilityRole="button"
          onPress={() => { setMenuOpen(false); router.push({pathname: '/trip-sharing', params: {id: trip.session.id}}); }} style={{ padding: 14 }}>
          <Text style={{ color: c.text }}>{trip.session.phase === 'recording' ? t("Live sharing") : t("Publish / manage sharing")}</Text>
        </Pressable>}
        <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); void exportTrip(); }} style={{ padding: 14 }}>
          <Text style={{ color: c.text }}>{t("Export trip")}</Text>
        </Pressable>
        {trip.session.phase === "stopping" && (trip.archived || trip.session.mode === "local") && <Pressable accessibilityRole="button"
          onPress={() => { setMenuOpen(false); deleteTrip(); }} style={{ padding: 14 }}>
          <Text style={{ color: '#c45c55' }}>{t("Delete trip")}</Text>
        </Pressable>}
      </View>}
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
            <TripMap points={trip.points} selected={trip.points[index]} onViewportChange={setMapRegion} fitRequest={fitRequest} />
          </View>
          <View style={{ padding: 20, gap: 24 }}>
            {trip.session.phase === "recording" && (
              (trip.session.error || trip.session.lastTaskError || recordingStatus(trip.session, now) !== t("Recording")) && (
                <Pressable accessibilityRole={warning?.settings === false ? undefined : "button"} disabled={warning?.settings === false} onPress={() => router.push("/settings")}>
                  <Text accessibilityRole="alert" style={{ color: c.textSecondary }}>
                    {warning?.text ||
                      (trip.session.lastRecordedAt
                        ? t("No recent GPS positions. Your saved route is kept; recording will continue when GPS updates return.")
                        : t("No GPS positions have been saved yet. Recording will continue when a location fix arrives."))}
                    {warning?.settings !== false && t(" · Location & tracking settings ›")}
                  </Text>
                </Pressable>
              )
            )}
            {trip.session.mode === 'race' && trip.session.eventId && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/race-replay', params: { seriesId: trip.session.seriesId, eventId: trip.session.eventId!, tripId: trip.session.id } })} style={{ padding: 14, backgroundColor: c.buttonBg, borderRadius: 12 }}>
              <Text style={{ color: c.text }}>{t("Replay race · show competitors")}</Text>
            </Pressable>}

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Switch accessibilityLabel={t("Chart follows map")} value={chartFollowsMap} onValueChange={setChartFollowsMap} />
                <Text style={{ color: c.text }}>{t("Chart follows map")}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => { setMapRegion(undefined); setFitRequest(n => n + 1); }} style={{ paddingVertical: 12 }}>
                <Text style={{ color: "#008c80" }}>{t("Fit whole trip")}</Text>
              </Pressable>
            </View>
            <TripChart
              region={chartFollowsMap ? mapRegion : undefined}
              resetKey={fitRequest}
              points={trip.points}
              index={index}
              onSelect={setIndex}
              onScrubbing={setScrubbing}
            />

          </View>
        </ScrollView>
      ) : (
        <Text style={{ padding: 24, color: c.textMuted }}>
          {loading ? t("Loading trip…") : t("This trip is no longer available.")}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: c.text, padding: 16 }}>
          {translateMessage(error)}
        </Text>
      )}
    </SafeAreaView>
  );
}
