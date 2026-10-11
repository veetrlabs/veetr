import { boatReadingAt, chartMetrics } from '../tracking/chartSeries';
import { translateMessage, formatNumber, locale, t, useLanguageRefresh } from '../i18n';
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import TripChart from "../tracking/TripChart";
import FleetMap from "../regattas/FleetMap";
import type { Trip } from "../tracking/trip";
import { routeSegments, metricValue } from "../tracking/trip";
import { useReplayTracks } from "./useReplayTracks";
import { boatColor, type BoatTrack } from "./boatTracks";
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
  const language = useLanguageRefresh();
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [competitors, setCompetitors] = useState(!own),
    [at, setAt] = useState(0);
  const [heatId, setHeatId] = useState<string>();
  const [hidden, setHidden] = useState<string[]>([]);
  const [scrubbing, setScrubbing] = useState(false);
  const replay = useReplayTracks(seriesId, eventId, heatId, at, competitors, true);
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
        boatName: t("{{v0}} (you)", { v0: own.session.boatName || t("Your boat") }),
        trail: [],
        trailSegments: routeSegments(past).map((s) =>
          s.map((p) => [p.latitude, p.longitude]),
        ),
      });
    return result;
  }, [competitors, replay.positions, own, points, selected, language]);
  const ownId = own?.session.boatId || own?.session.id;
  const colors = useRef(new Map<string, string>());
  const boats = useMemo(() => {
    const colorFor = (id: string) => {
      if (!colors.current.has(id)) colors.current.set(id, boatColor(id, colors.current.values()));
      return colors.current.get(id)!;
    };
    const tracks = new Map<string, BoatTrack>();
    if (ownId) tracks.set(ownId, { id: ownId, name: own?.session.boatName || t("Your boat"), color: colorFor(ownId), points });
    if (competitors) for (const point of replay.tracks ?? []) {
      if (point.boatId === ownId) continue;
      let track = tracks.get(point.boatId);
      if (!track) {
        track = { id: point.boatId, name: point.boatName, color: colorFor(point.boatId), points: [] };
        tracks.set(point.boatId, track);
      }
      track.points.push(point);
    }
    return [...tracks.values()].map(track => ({ ...track, points: [...track.points].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)) }));
  }, [ownId, own?.session.boatName, points, competitors, replay.tracks, language]);
  const visibleBoats = useMemo(() => boats.filter(boat => !hidden.includes(boat.id)), [boats, hidden]);
  // One chronological cursor drives every boat; tracks remain separate when drawn.
  const chartPoints = useMemo(() => [...new Map(boats.flatMap(boat => boat.points).map(point => [point.recordedAt, point])).values()]
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)), [boats]);
  const chartIndex = Math.max(0, chartPoints.findLastIndex(p => Date.parse(p.recordedAt) <= selected));
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
    <ScrollView scrollEnabled={!scrubbing} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
      <View
        style={{ paddingHorizontal: 16, gap: 8 }}
      >
        <Text style={{ color: c.text }}>
          {own?.session.raceName || t("Race replay")}
        </Text>
        {own &&
          button(competitors ? t("Hide competitors") : t("Show competitors"), () => {
            setCompetitors(!competitors);
            setHeatId(undefined);
          })}
        {competitors && (
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            {button(
              t("Whole race"),
              () => {
                setHeatId(undefined);
                setAt(0);
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
                },
                !h.start,
                heatId === h.id,
              ),
            )}
          </ScrollView>
        )}
        {!!selected && (
          <Text style={{ color: c.text }}>
            {new Date(selected).toLocaleString(locale())}
          </Text>
        )}
        {replay.loading && competitors && (
          <Text style={{ color: c.textMuted }}>{t("Loading competitors…")}</Text>
        )}
        {!!replay.error && competitors && (
          <>
            {<Text style={{ color: c.text }}>{translateMessage(replay.error)}</Text>}
            {button(t("Retry replay"), replay.retry)}
          </>
        )}
        {!start && !replay.loading && (
          <Text style={{ color: c.textMuted }}>
            {t("No recorded positions available.")}</Text>
        )}
      </View>
      <View style={{ height: 340, marginHorizontal: 16, borderRadius: 18, overflow: 'hidden' }}>
        <FleetMap
          key={`${seriesId}:${eventId}:${heatId ?? ""}`}
          loading={replay.loading}
          course={own?.session.course}
          positions={positions.filter((p) => !hidden.includes(p.boatId))}
          at={selected}
          ownBoatId={ownId}
          routes={visibleBoats}
        />
      </View>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {boats.map(boat => {
            const visible = !hidden.includes(boat.id);
            const reading = boatReadingAt(boat, selected);
            const metrics = chartMetrics.filter(metric => metric.key === 'sog' || boat.points.some(point => metricValue(point, metric.key) !== null));
            return <Pressable key={boat.id} accessible accessibilityRole="checkbox"
              accessibilityLabel={boat.name} accessibilityState={{ checked: visible }}
              onPress={() => setHidden(ids => ids.includes(boat.id) ? ids.filter(id => id !== boat.id) : [...ids, boat.id])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, maxWidth: '100%',
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: c.buttonBg }}>
              <Text style={{ color: visible ? boat.color : c.textMuted, fontSize: 18 }}>{visible ? '●' : '○'}</Text>
              <View style={{ flexShrink: 1, gap: 3 }}>
                <Text style={{ color: c.text }}>{boat.name}</Text>
                {visible && <Text style={{ color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] }}>
                  {metrics.map(metric => {
                    const value = reading ? metricValue(reading, metric.key) : null;
                    return `${metric.label} ${value === null ? '—' : formatNumber(value, 1)}`;
                  }).join(' · ')} kn
                </Text>}
              </View>
            </Pressable>;
          })}
        </View>
        {chartPoints.length > 0 && <TripChart points={chartPoints} index={chartIndex}
          boatTracks={visibleBoats}
          onScrubbing={setScrubbing} onSelect={index => setAt(Date.parse(chartPoints[index].recordedAt))} />}
      </View>
      <Text style={{ color: c.textMuted, textAlign: "center", fontSize: 11 }}>
        {t("Seamarks © OpenSeaMap contributors · Competitors cached only while this view is open")}</Text>
    </ScrollView>
  );
}
