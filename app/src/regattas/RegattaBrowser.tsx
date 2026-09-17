import { useEffect, useState } from "react";
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
  replayStep,
} from "./model";
import { parseTrackingPositions, type TrackingPosition } from "./positions";
import FleetMap from "./FleetMap";
import { retryRegattaRead, regattaReadError } from "./read";
import SeriesDetail from "./SeriesDetail";
import RegattaResults from "./RegattaResults";
import type { Series } from "../../../veetr.org/src/features/racing/domain";

export default function RegattaBrowser({ onShare }: { onShare?: () => void } = {}) {
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [rows, setRows] = useState<RaceRegatta[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filter, setFilter] = useState<RegattaFilter>("All"),
    [selected, setSelected] = useState<RaceRegatta | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    async function load() {
      if (!trackingClient)
        throw new Error(
          "Regattas are unavailable. Check your connection and try again.",
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
        return series ? publishedRaceRegattas(row, series) : [];
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
    };
  }, [revision]);
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
      <Text style={{ color: c.text, fontSize: 28, fontWeight: "700" }}>Regattas</Text>
      {onShare && button("Share boat location", onShare)}
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {(["All", "Live", "Upcoming", "Past"] as RegattaFilter[]).map((f) =>
          button(f, () => setFilter(f), filter === f),
        )}
      </View>
      {loading && revision === 0 && <Text style={{ color: c.textMuted }}>Loading races…</Text>}
      {error && (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {error}
        </Text>
      )}
      {!loading &&
        !error &&
        !rows.filter((r) => filter === "All" || regattaState(r) === filter)
          .length && (
          <Text style={{ color: c.textMuted }}>
            No {filter === "All" ? "published" : filter.toLowerCase()} races
            yet.
          </Text>
        )}
      {rows
        .filter((r) => filter === "All" || regattaState(r) === filter)
        .map((r) => (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${r.name}`}
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
              {regattaState(r) === "Scheduled" ? "Date not set" : regattaState(r)} · {r.firstDate || r.year} · {r.boatCount} boats
            </Text>
            {r.replayStart && (
              <Text style={{ color: c.textSecondary }}>Replay available</Text>
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
  const { theme } = useTheme(),
    c = themeColors[theme];
  type Page = {kind:"race"; regatta:RaceRegatta} | {kind:"series"; series:Series} | {kind:"boat"; series:Series; boatId:string};
  const [pages, setPages] = useState<Page[]>([{kind:"race",regatta:initialRace}]);
  const page = pages[pages.length-1];
  const r = page.kind === "race" ? page.regatta : initialRace;
  const navigate = (next:Page) => { setPages(history=>[...history,next]); setTab("Results"); setPlaying(false); };
  const [tab, setTab] = useState<"Results" | "Live" | "Replay">("Results");
  const replay = tab === "Replay";
  const hasReplay = Number.isFinite(Date.parse(r.replayStart || "")) && Number.isFinite(Date.parse(r.replayEnd || "")) && Date.parse(r.replayEnd!) >= Date.parse(r.replayStart!);
  const [playing, setPlaying] = useState(false);
  const [retry, setRetry] = useState(0);
  const start = Date.parse(r.replayStart || ""),
    end = Date.parse(r.replayEnd || "");
  const [at, setAt] = useState(start),
    [positions, setPositions] = useState<TrackingPosition[]>([]),
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
          replay ? "public_regatta_replay" : "public_tracking_positions",
          {
            p_series: r.seriesId,
            ...(replay ? { p_at: new Date(at).toISOString() } : {}),
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
          setPlaying(false);
        }
      } finally {
        if (alive) {
          setLoading(false);
          if (!replay) timer = setTimeout(refresh, 5000);
        }
      }
    };
    void refresh();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [r.id, page.kind, tab, replay, at, retry]);
  useEffect(() => {
    if (!replay || !playing || loading) return;
    const timer = setTimeout(() => {
      if (at >= end) setPlaying(false);
      else setAt(replayStep(at, 20000, start, end));
    }, 1000);
    return () => clearTimeout(timer);
  }, [replay, playing, loading, at, start, end]);
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
      <Text style={{ color: c.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {action(pages.length > 1 ? "Back" : "Close", pages.length > 1 ? () => { setPages(history=>history.slice(0,-1)); setTab("Results"); setPlaying(false); } : close)}
            <Text
              style={{
                flex: 1,
                color: c.text,
                fontSize: 20,
                fontWeight: "700",
              }}
            >
              {page.kind === "race" ? r.name : page.kind === "series" ? page.series.name : "Boat details"}
            </Text>
          </View>
          {page.kind === "race" && (hasReplay || (r.liveBoats ?? 0) > 0) && <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(["Results", ...((r.liveBoats ?? 0) > 0 ? ["Live"] : []), ...(hasReplay ? ["Replay"] : [])] as const).map((label) => (
              <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }}
                onPress={() => { setTab(label as typeof tab); setPlaying(false); if (label === "Replay") setAt(start); }}
                style={{ minHeight: 44, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, backgroundColor: tab === label ? "#006b62" : c.buttonBg }}>
                <Text style={{ color: tab === label ? "white" : c.text, fontWeight: "600" }}>{label}</Text>
              </Pressable>
            ))}
          </View>}
          {replay && (
            <>
              <Text style={{ color: c.text }}>
                {new Date(at).toLocaleString()}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {action(
                  "−5 min",
                  () => setAt(replayStep(at, -300000, start, end)),
                  at <= start,
                )}
                {action(playing ? "Pause" : "Play", () => {
                  if (at >= end) setAt(start);
                  setPlaying(!playing);
                })}
                {action(
                  "+5 min",
                  () => setAt(replayStep(at, 300000, start, end)),
                  at >= end,
                )}
              </View>
            </>
          )}
          {tab !== "Results" && error && action("Retry positions", () => setRetry((v) => v + 1))}
          {tab === "Results" ? null : error ? (
            <Text accessibilityRole="alert" style={{ color: c.text }}>
              {error}
            </Text>
          ) : loading ? (
            <Text style={{ color: c.textMuted }}>Loading positions…</Text>
          ) : !positions.length ? (
            <Text style={{ color: c.textMuted }}>
              {replay
                ? "No shared positions at this time."
                : "No boats sharing right now."}
            </Text>
          ) : null}
        </View>
        {page.kind !== "race" ? <SeriesDetail key={page.kind === "boat" ? page.boatId : page.series.id} series={page.series} boatId={page.kind === "boat" ? page.boatId : undefined}
          onBoat={boatId=>navigate({kind:"boat",series:page.series,boatId})}
          onRace={eventId=>{
            const race = publishedRaceRegattas({ ...initialRace, liveBoats:0, replayStart:undefined, replayEnd:undefined }, page.series).find(race=>race.eventId===eventId);
            if (race) navigate({kind:"race",regatta:race});
          }} /> : tab === "Results" ? <RegattaResults key={r.id} seriesId={r.seriesId} eventId={r.eventId} onSeries={series=>navigate({kind:"series",series})} /> : <>
        {positions.length > 0 && <FleetMap
          key={replay ? "replay" : "live"}
          positions={positions}
          at={replay ? at : now}
        />}
        <ScrollView
          style={{ maxHeight: 120 }}
          contentContainerStyle={{ padding: 12, gap: 6 }}
        >
          {positions.map((p) => (
            <Text key={p.boatId} style={{ color: c.text }}>
              {p.boatName} ·{" "}
              {p.sogMps === null ? "—" : (p.sogMps * 1.94384449).toFixed(1)} kn
              {(replay ? at : now) - Date.parse(p.recordedAt) > 60000
                ? " · stale GPS"
                : ""}
            </Text>
          ))}
        </ScrollView>
        </>}
        {page.kind === "race" && <View style={{ padding: 16, gap: 8 }}>
          {action(
            "Open on website",
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
            Seamarks © OpenSeaMap contributors
          </Text>}
        </View>}
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
