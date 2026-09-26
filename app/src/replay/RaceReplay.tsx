import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import FleetMap from "../regattas/FleetMap";
import type { Trip } from "../tracking/trip";
import { routeSegments } from "../tracking/trip";
import { useReplayTracks } from "./useReplayTracks";
import type { TrackingPosition } from "../regattas/positions";

export default function RaceReplay({
  seriesId,
  eventId,
  own,
}: {
  seriesId: string;
  eventId: string;
  own?: Trip;
}) {
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [competitors, setCompetitors] = useState(!own),
    [at, setAt] = useState(0);
  const [heatId, setHeatId] = useState<string>(),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(10);
  const [hidden, setHidden] = useState<string[]>([]);
  const [width, setWidth] = useState(1);
  const replay = useReplayTracks(seriesId, eventId, heatId, at, competitors);
  const heat = replay.meta?.heats.find((h) => h.id === heatId);
  const points = useMemo(
    () =>
      (own?.points ?? []).filter(
        (p) =>
          (!heat?.start || p.recordedAt >= heat.start) &&
          (!heat?.end || p.recordedAt <= heat.end),
      ),
    [own?.points, heat?.start, heat?.end],
  );
  const starts = [
    points[0] ? Date.parse(points[0].recordedAt) : NaN,
    replay.meta?.start ?? NaN,
  ].filter(Number.isFinite);
  const ends = [
    points.at(-1) ? Date.parse(points.at(-1)!.recordedAt) : NaN,
    replay.meta?.end ?? NaN,
  ].filter(Number.isFinite);
  const start = starts.length ? Math.min(...starts) : 0,
    end = ends.length ? Math.max(...ends) : 0;
  const selected = start ? Math.max(start, Math.min(at || start, end)) : 0;
  useEffect(() => {
    if (selected !== at) setAt(selected);
  }, [selected, at]);
  useEffect(() => {
    if (!playing || !start || (competitors && (replay.loading || replay.error)))
      return;
    if (selected >= end) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(
      () => setAt(Math.min(end, selected + 200 * speed)),
      200,
    );
    return () => clearTimeout(timer);
  }, [
    playing,
    selected,
    end,
    speed,
    competitors,
    replay.loading,
    replay.error,
    start,
  ]);
  const positions = useMemo(() => {
    const result: TrackingPosition[] = (
      competitors ? replay.positions : []
    ).filter((p) => !own || p.boatId !== own.session.boatId);
    const past = points.filter((p) => Date.parse(p.recordedAt) <= selected),
      last = past.at(-1);
    if (own && last)
      result.push({
        ...last,
        boatId: own.session.boatId || own.session.id,
        boatName: `${own.session.boatName || "Your boat"} (you)`,
        trail: [],
        trailSegments: routeSegments(past).map((s) =>
          s.map((p) => [p.latitude, p.longitude]),
        ),
      });
    return result;
  }, [competitors, replay.positions, own, points, selected]);
  const button = (
    label: string,
    action: () => void,
    disabled = false,
    chosen = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: chosen }}
      disabled={disabled}
      onPress={action}
      style={{
        padding: 12,
        minHeight: 44,
        borderRadius: 10,
        backgroundColor: chosen ? "#006b62" : c.buttonBg,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: chosen ? "white" : c.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <ScrollView
        style={{ flexGrow: 0, flexShrink: 1, maxHeight: "52%" }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        <Text style={{ color: c.text }}>
          {own?.session.raceName || "Race replay"}
        </Text>
        {own &&
          button(competitors ? "Hide competitors" : "Show competitors", () => {
            setCompetitors(!competitors);
            setPlaying(false);
            setHeatId(undefined);
          })}
        {competitors && (
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            {button(
              "Whole race",
              () => {
                setHeatId(undefined);
                setAt(0);
                setPlaying(false);
              },
              false,
              !heatId,
            )}
            {replay.meta?.heats.map((h) =>
              button(
                h.name,
                () => {
                  setHeatId(h.id);
                  setAt(h.start ? Date.parse(h.start) : 0);
                  setPlaying(false);
                },
                !h.start,
                heatId === h.id,
              ),
            )}
          </ScrollView>
        )}
        {!!selected && (
          <Text style={{ color: c.text }}>
            {new Date(selected).toLocaleString()}
          </Text>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {button(
            "−1 min",
            () => {
              setAt(Math.max(start, selected - 60000));
              setPlaying(false);
            },
            !start,
          )}
          {button(
            playing ? "Pause" : "Play",
            () => {
              if (selected >= end) setAt(start);
              setPlaying(!playing);
            },
            !start || start === end,
          )}
          {button(
            "+1 min",
            () => {
              setAt(Math.min(end, selected + 60000));
              setPlaying(false);
            },
            !start,
          )}
          {button(`${speed}×`, () =>
            setSpeed(speed === 1 ? 10 : speed === 10 ? 30 : 1),
          )}
        </View>
        {!!start && (
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Replay timeline"
            accessibilityValue={{
              min: start,
              max: end,
              now: selected,
              text: new Date(selected).toLocaleTimeString(),
            }}
            accessibilityActions={[
              { name: "increment" },
              { name: "decrement" },
            ]}
            onAccessibilityAction={(e) => {
              setPlaying(false);
              setAt(
                Math.max(
                  start,
                  Math.min(
                    end,
                    selected +
                      (e.nativeEvent.actionName === "increment"
                        ? 10000
                        : -10000),
                  ),
                ),
              );
            }}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(e) => seek(e.nativeEvent.locationX)}
            onResponderMove={(e) => seek(e.nativeEvent.locationX)}
            style={{ height: 40, justifyContent: "center" }}
          >
            <View
              style={{ height: 6, borderRadius: 3, backgroundColor: c.border }}
            >
              <View
                style={{
                  height: 6,
                  backgroundColor: "#008c80",
                  width: `${(100 * (selected - start)) / Math.max(1, end - start)}%`,
                }}
              />
            </View>
          </View>
        )}
        {replay.loading && competitors && (
          <Text style={{ color: c.textMuted }}>Loading competitors…</Text>
        )}
        {!!replay.error && competitors && (
          <>
            {<Text style={{ color: c.text }}>{replay.error}</Text>}
            {button("Retry replay", replay.retry)}
          </>
        )}
        {!start && !replay.loading && (
          <Text style={{ color: c.textMuted }}>
            No recorded positions available.
          </Text>
        )}
      </ScrollView>
      <View style={{ flex: 1, minHeight: 120 }}>
        <FleetMap
          positions={positions.filter((p) => !hidden.includes(p.boatId))}
          at={selected}
          ownBoatId={own?.session.boatId || own?.session.id}
        />
      </View>
      <ScrollView
        horizontal
        style={{ maxHeight: 60 }}
        contentContainerStyle={{ padding: 8, gap: 8 }}
      >
        {positions.map((p) =>
          button(
            `${hidden.includes(p.boatId) ? "○" : "●"} ${p.boatName}${selected - Date.parse(p.recordedAt) > 60000 ? " · stale" : ""}`,
            () =>
              setHidden((ids) =>
                ids.includes(p.boatId)
                  ? ids.filter((id) => id !== p.boatId)
                  : [...ids, p.boatId],
              ),
          ),
        )}
      </ScrollView>
      <Text style={{ color: c.textMuted, textAlign: "center", fontSize: 11 }}>
        Seamarks © OpenSeaMap contributors · Competitors cached only while this
        view is open
      </Text>
    </View>
  );
  function seek(x: number) {
    setPlaying(false);
    setAt(
      start + Math.max(0, Math.min(1, x / Math.max(1, width))) * (end - start),
    );
  }
}
