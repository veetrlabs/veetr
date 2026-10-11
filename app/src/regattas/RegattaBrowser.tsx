import BackButton from '../components/BackButton';
import { raceReplayBounds } from './replayAvailability';
import { formatNumber, locale, translateMessage, t, useLanguageRefresh } from '../i18n';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { trackingClient, trackingRpc } from "../tracking/client";
import {
  type Regatta,
  type RaceRegatta,
  publishedRaceRegattas,
  type RegattaFilter,
  regattaState,
} from "./model";
import { parseTrackingPositions, type TrackingPosition } from "./positions";
import FleetMap from "./FleetMap";
import { retryRegattaRead, regattaReadError } from "./read";
import { savedSeriesPhone, seriesPhoneStatus, type SeriesPhone } from "../tracking/seriesPhone";
import SeriesDetail from "./SeriesDetail";
import RegattaResults from "./RegattaResults";
import type { Series } from "../../../veetr.org/src/features/racing/domain";

export default function RegattaBrowser({ onShare }: { onShare?: () => void } = {}) {
  useLanguageRefresh();
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [rows, setRows] = useState<RaceRegatta[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filter, setFilter] = useState<RegattaFilter>("All"),
    [selected, setSelected] = useState<RaceRegatta | null>(null);
  const [revision, setRevision] = useState(0);
  const [joined, setJoined] = useState<SeriesPhone | null>(null);
  const [joinedError, setJoinedError] = useState("");
  useFocusEffect(useCallback(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setJoinedError("");
    void (async () => {
      try {
        const saved = await savedSeriesPhone();
        if (!alive) return;
        setJoined(saved);
        if (saved) {
          const status = await seriesPhoneStatus(saved.linkId);
          if (alive) setJoined(status);
        }
      } catch (e) {
        if (alive) setJoinedError(regattaReadError(e));
      }
    })();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") setRevision(value => value + 1);
    });
    async function load() {
      if (!trackingClient)
        throw new Error(
          "Races are unavailable. Check your connection and try again.",
        );
      const reply = await trackingClient.rpc("public_regatta_directory");
      let directory: Regatta[];
      if (reply.error) {
        // Compatibility while the spectator migration is being deployed.
        if (reply.error.code !== "PGRST202")
          throw new Error(reply.error.message);
        directory = await trackingRpc<Regatta[]>("public_series_directory");
      } else directory = reply.data as Regatta[];
      const races = await Promise.all(directory.map(async row => {
        const series = await trackingRpc<Series | null>("public_standings", { series_id: row.id });
        return series ? Promise.all(publishedRaceRegattas(row, series).map(async race => {
          // A failed availability request must not hide the race results.
          try { return { ...race, ...await raceReplayBounds(race) }; }
          catch { return { ...race, replayStart: undefined, replayEnd: undefined }; }
        })) : [];
      }));
      return races.flat();
    }
    void retryRegattaRead(load, () => alive)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((e) => {
        if (alive) setError(regattaReadError(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, [revision]));
  const button = (title: string, onPress: () => void, chosen = false) => (
    <Pressable
      key={title}
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
      onPress={onPress}
      style={{
        padding: 12,
        borderRadius: 20,
        backgroundColor: chosen ? "#006b62" : c.buttonBg,
      }}
    >
      <Text style={{ color: chosen ? "white" : c.text }}>{title}</Text>
    </Pressable>
  );
  return (
    <ScrollView
      testID="regatta-list"
      style={{ flex: 1 }}
      alwaysBounceVertical
      contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 16, paddingBottom: 36 }}
      refreshControl={<RefreshControl
        refreshing={loading && revision > 0}
        onRefresh={() => { if (!loading) { setLoading(true); setRevision(v => v + 1); } }}
        tintColor={c.text}
        colors={["#006b62"]}
      />}
    >
      <Text style={{ color: c.text, fontSize: 28, fontWeight: "700" }}>{t("Races")}</Text>
      {joined && <View style={{ gap: 12 }}>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>{t("Your boat")}: {joined.boatName}</Text>
        <Text style={{ color: c.textMuted }}>{joined.seriesName}</Text>
        {joined.valid ? <>
          <Text style={{ color: c.text }}>{t("Choose a race below, then press Ready to race to join.")}</Text>
          {joined.races.map(race => <Pressable key={race.eventId} accessibilityRole="button"
            accessibilityLabel={t("Join {{v0}}", { v0: race.raceName })}
            onPress={() => router.push({ pathname: "/race-phone", params: { eventId: race.eventId } })}
            style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#009688", gap: 6 }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>{race.raceName}</Text>
            <Text style={{ color: c.textMuted }}>{new Date(race.scheduledStart).toLocaleString(locale())}</Text>
            <Text style={{ color: c.text, fontWeight: "600" }}>{t("Join race")}</Text>
          </Pressable>)}
          {!joined.races.length && <Text style={{ color: c.textMuted }}>{t("No upcoming published races for your boat yet. Your series invitation remains available.")}</Text>}
        </> : <Text style={{ color: c.text }}>{t("This invitation has expired or been revoked. Ask the referee for a new link.")}</Text>}
      </View>}
      {!!joinedError && <Text accessibilityRole="alert" style={{ color: c.text }}>{translateMessage(joinedError)}</Text>}
      {onShare && !joined && button(t("Join with invitation"), onShare)}
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {(["All", "Live", "Upcoming", "Past"] as RegattaFilter[]).map((f) =>
          button(t(f), () => setFilter(f), filter === f),
        )}
      </View>
      {loading && revision === 0 && <Text style={{ color: c.textMuted }}>{t("Loading races…")}</Text>}
      {error && (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {translateMessage(error)}
        </Text>
      )}
      {!loading &&
        !error &&
        !rows.filter((r) => filter === "All" || regattaState(r) === filter)
          .length && (
          <Text style={{ color: c.textMuted }}>
            {t(`No ${filter === "All" ? "published" : filter.toLowerCase()} races yet.`)}</Text>
        )}
      {rows
        .filter((r) => filter === "All" || regattaState(r) === filter)
        .map((r) => (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={t("View {{v0}}", { v0: r.name })}
            onPress={() => setSelected(r)}
            style={{
              padding: 16,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 12,
              gap: 6,
              backgroundColor: c.panelBg,
            }}
          >
            <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
              {r.name}
            </Text>
            <Text style={{ color: c.textMuted }}>
              {regattaState(r) === "Scheduled" ? t("Date not set") : t(regattaState(r))} · {r.firstDate || r.year} · {t("{{count}} boat", { count: r.boatCount })}</Text>
            {r.replayStart && (
              <Text style={{ color: c.textSecondary }}>{t("Replay available")}</Text>
            )}
          </Pressable>
        ))}
      {selected && (
        <Spectator regatta={selected} close={() => setSelected(null)} />
      )}
    </ScrollView>
  );
}
function Spectator({
  regatta: initialRace,
  close,
}: {
  regatta: RaceRegatta;
  close: () => void;
}) {
  useLanguageRefresh();
  const { theme } = useTheme(),
    c = themeColors[theme];
  type Page = {kind:"race"; regatta:RaceRegatta} | {kind:"series"; series:Series} | {kind:"boat"; series:Series; boatId:string};
  const [pages, setPages] = useState<Page[]>([{kind:"race",regatta:initialRace}]);
  const page = pages[pages.length-1];
  const r = page.kind === "race" ? page.regatta : initialRace;
  const navigate = (next:Page) => { setPages(history=>[...history,next]); setTab("Results"); };
  const [tab, setTab] = useState<"Results" | "Live">("Results");
  const [replayAvailability, setReplayAvailability] = useState<{id: string; start?: string; end?: string; error?: boolean}>();
  const [replayRetry, setReplayRetry] = useState(0);
  useEffect(() => {
    if (page.kind !== 'race') return;
    let alive = true;
    void raceReplayBounds(r).then(bounds => {
      if (alive) setReplayAvailability({ id: r.id, start: bounds.replayStart, end: bounds.replayEnd });
    }).catch(() => { if (alive) setReplayAvailability({ id: r.id, error: true }); });
    return () => { alive = false; };
  }, [page.kind, r.id, r.seriesId, r.eventId, replayRetry]);
  const replay = replayAvailability?.id === r.id ? replayAvailability : undefined;
  const hasReplay = !!(replay ? replay.start && replay.end : r.replayStart && r.replayEnd);
  const [retry, setRetry] = useState(0);
  const [positions, setPositions] = useState<TrackingPosition[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (tab === "Results" || page.kind !== "race") return;
    let alive = true,
      timer: ReturnType<typeof setTimeout>;
    setPositions([]);
    setLoading(true);
    setError("");
    const refresh = async () => {
      if (AppState.currentState === "background") {
        timer = setTimeout(refresh, 5000);
        return;
      }
      try {
        const result = await trackingRpc(
          "public_tracking_positions",
          {
            p_series: r.seriesId,
          },
        );
        if (alive) {
          setPositions(parseTrackingPositions(result).filter(p => r.boatIds.includes(p.boatId)));
          setError("");
          setNow(Date.now());
        }
      } catch (e) {
        if (alive) {
          setPositions([]);
          setError("Boat positions could not be loaded. Try again.");

        }
      } finally {
        if (alive) {
          setLoading(false);
          timer = setTimeout(refresh, 5000);
        }
      }
    };
    void refresh();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [r.id, page.kind, tab, retry]);
  const action = (label: string, fn: () => void, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={fn}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        backgroundColor: c.buttonBg,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: c.text }}>{t(label)}</Text>
    </Pressable>
  );
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {pages.length > 1 ? <BackButton onPress={() => { setPages(history=>history.slice(0,-1)); setTab("Results"); }} /> : action(t("Close"), close)}
            <Text
              style={{
                flex: 1,
                color: c.text,
                fontSize: 20,
                fontWeight: "700",
              }}
            >
              {page.kind === "race" ? r.name : page.kind === "series" ? page.series.name : t("Boat details")}
            </Text>
          </View>
          {page.kind === "race" && (hasReplay || (r.liveBoats ?? 0) > 0) && <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(["Results", ...((r.liveBoats ?? 0) > 0 ? ["Live"] : []), ...(hasReplay ? ["Replay"] : [])] as const).map((label) => (
              <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }}
                onPress={() => { if (label === 'Replay') { close(); router.push({ pathname: '/race-replay', params: { seriesId: r.seriesId, eventId: r.eventId } }); return; } setTab(label as typeof tab); }}
                style={{ minHeight: 44, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, backgroundColor: tab === label ? "#006b62" : c.buttonBg }}>
                <Text style={{ color: tab === label ? "white" : c.text, fontWeight: "600" }}>{t(label)}</Text>
              </Pressable>
            ))}
          </View>}
          {page.kind === 'race' && replay?.error && action(t("Retry replay availability"), () => setReplayRetry(v => v + 1))}
          {tab !== "Results" && error && action(t("Retry positions"), () => setRetry((v) => v + 1))}
          {tab === "Results" ? null : error ? (
            <Text accessibilityRole="alert" style={{ color: c.text }}>
              {translateMessage(error)}
            </Text>
          ) : loading ? (
            <Text style={{ color: c.textMuted }}>{t("Loading positions…")}</Text>
          ) : !positions.length ? (
            <Text style={{ color: c.textMuted }}>
              {t("No boats sharing right now.")}</Text>
          ) : null}
        </View>
        {page.kind !== "race" ? <SeriesDetail key={page.kind === "boat" ? page.boatId : page.series.id} series={page.series} boatId={page.kind === "boat" ? page.boatId : undefined}
          onBoat={boatId=>navigate({kind:"boat",series:page.series,boatId})}
          onRace={eventId=>{
            const race = publishedRaceRegattas({ ...initialRace, liveBoats:0, replayStart:undefined, replayEnd:undefined }, page.series).find(race=>race.eventId===eventId);
            if (race) navigate({kind:"race",regatta:race});
          }} /> : tab === "Results" ? <RegattaResults key={r.id} seriesId={r.seriesId} eventId={r.eventId} onSeries={series=>navigate({kind:"series",series})} /> : <>
        {positions.length > 0 && <FleetMap
          positions={positions}
          at={now}
        />}
        <ScrollView
          style={{ maxHeight: 120 }}
          contentContainerStyle={{ padding: 12, gap: 6 }}
        >
          {positions.map((p) => (
            <Text key={p.boatId} style={{ color: c.text }}>
              {p.boatName} ·{" "}
              {p.sogMps === null ? "—" : formatNumber((p.sogMps * 1.94384449), 1)} kn
              {now - Date.parse(p.recordedAt) > 60000
                ? t(" · stale GPS")
                : ""}
            </Text>
          ))}
        </ScrollView>
        </>}
        {page.kind === "race" && <View style={{ padding: 16, gap: 8 }}>
          {action(
            t("Open on website"),
            () =>
              void Linking.openURL(
                `https://veetr.org/races/?series=${encodeURIComponent(r.seriesId)}&event=${encodeURIComponent(r.eventId)}`,
              ),
          )}
          {tab !== "Results" && positions.length > 0 && <Text
            style={{
              color: c.textMuted,
              fontSize: 11,
              textAlign: "center",
              paddingTop: 6,
            }}
          >
            {t("Seamarks © OpenSeaMap contributors")}</Text>}
        </View>}
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
