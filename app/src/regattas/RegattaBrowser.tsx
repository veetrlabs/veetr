import { useEffect, useState } from "react";
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { trackingClient, trackingRpc } from "../tracking/client";
import {
  type Regatta,
  type RegattaFilter,
  regattaState,
  replayStep,
} from "./model";
import { parseTrackingPositions, type TrackingPosition } from "./positions";
import FleetMap from "./FleetMap";

export default function RegattaBrowser() {
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [rows, setRows] = useState<Regatta[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filter, setFilter] = useState<RegattaFilter>("All"),
    [selected, setSelected] = useState<Regatta | null>(null);
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
      if (reply.error) {
        // Compatibility while the spectator migration is being deployed.
        if (reply.error.code !== "PGRST202")
          throw new Error(reply.error.message);
        return trackingRpc<Regatta[]>("public_series_directory");
      }
      return reply.data as Regatta[];
    }
    void load()
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
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
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {(["All", "Live", "Upcoming", "Past"] as RegattaFilter[]).map((f) =>
          button(f, () => setFilter(f), filter === f),
        )}
      </View>
      {loading && <Text style={{ color: c.textMuted }}>Loading regattas…</Text>}
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
            No {filter === "All" ? "published" : filter.toLowerCase()} regattas
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
              {regattaState(r)} · {r.firstDate || r.year} · {r.boatCount} boats
            </Text>
            {r.replayStart && (
              <Text style={{ color: c.textSecondary }}>Replay available</Text>
            )}
          </Pressable>
        ))}
      {button("Refresh", () => setRevision((v) => v + 1))}
      {selected && (
        <Spectator regatta={selected} close={() => setSelected(null)} />
      )}
    </View>
  );
}
function Spectator({
  regatta: r,
  close,
}: {
  regatta: Regatta;
  close: () => void;
}) {
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [replay, setReplay] = useState(false),
    [playing, setPlaying] = useState(false);
  const [retry, setRetry] = useState(0);
  const start = Date.parse(r.replayStart || ""),
    end = Date.parse(r.replayEnd || "");
  const [at, setAt] = useState(start),
    [positions, setPositions] = useState<TrackingPosition[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
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
            p_series: r.id,
            ...(replay ? { p_at: new Date(at).toISOString() } : {}),
          },
        );
        if (alive) {
          setPositions(parseTrackingPositions(result));
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
  }, [r.id, replay, at, retry]);
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
        padding: 12,
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
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {action("Close", close)}
            <Text
              style={{
                flex: 1,
                color: c.text,
                fontSize: 20,
                fontWeight: "700",
              }}
            >
              {r.name}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {action("Live", () => {
              setReplay(false);
              setPlaying(false);
            })}
            {action(
              "Replay",
              () => {
                setAt(start);
                setReplay(true);
              },
              !Number.isFinite(start) || !Number.isFinite(end),
            )}
          </View>
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
          {error && action("Retry positions", () => setRetry((v) => v + 1))}
          {error ? (
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
        <FleetMap
          key={replay ? "replay" : "live"}
          positions={positions}
          at={replay ? at : now}
        />
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
        <View style={{ padding: 10 }}>
          {action(
            "Results & event details",
            () =>
              void Linking.openURL(
                `https://veetr.org/races/?series=${encodeURIComponent(r.id)}`,
              ),
          )}
          <Text
            style={{
              color: c.textMuted,
              fontSize: 11,
              textAlign: "center",
              paddingTop: 6,
            }}
          >
            Seamarks © OpenSeaMap contributors
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
