import { translateMessage, locale, t, useLanguageRefresh } from '../i18n';
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import TripChart from "../tracking/TripChart";
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
  const language = useLanguageRefresh();
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [competitors, setCompetitors] = useState(!own),
    [at, setAt] = useState(0);
  const [heatId, setHeatId] = useState<string>();
  const [hidden, setHidden] = useState<string[]>([]);
  const [selectedBoat, setSelectedBoat] = useState<string>();
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
  const boats = [...new Map([
    ...(ownId ? [[ownId, own?.session.boatName || t("Your boat")] as const] : []),
    ...(replay.tracks ?? []).map(p => [p.boatId, p.boatName] as const),
  ]).entries()];
  const chartBoat = boats.some(([id]) => id === selectedBoat) ? selectedBoat : boats[0]?.[0];
  const chartPoints = useMemo(() => chartBoat === ownId ? points : (replay.tracks ?? []).filter(p => p.boatId === chartBoat), [chartBoat, ownId, points, replay.tracks]);
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
          route={chartPoints}
        />
      </View>
      <ScrollView
        horizontal
        style={{ maxHeight: 60 }}
        contentContainerStyle={{ padding: 8, gap: 8 }}
      >
        {positions.map((p) =>
          button(
            `${hidden.includes(p.boatId) ? "○" : "●"} ${p.boatName}${selected - Date.parse(p.recordedAt) > 60000 ? t(" · stale") : ""}`,
            () =>
              setHidden((ids) =>
                ids.includes(p.boatId)
                  ? ids.filter((id) => id !== p.boatId)
                  : [...ids, p.boatId],
              ),
          ),
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <Text style={{ color: c.text, fontWeight: '600' }}>{t("Boat instruments")}</Text>
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {boats.map(([id, name]) => button(name, () => setSelectedBoat(id), false, id === chartBoat))}
        </ScrollView>
        {chartPoints.length > 0 && <TripChart key={chartBoat} points={chartPoints} index={chartIndex}
          showRangeLabel={false}
          onScrubbing={setScrubbing} onSelect={index => setAt(Date.parse(chartPoints[index].recordedAt))} />}
      </View>
      <Text style={{ color: c.textMuted, textAlign: "center", fontSize: 11 }}>
        {t("Seamarks © OpenSeaMap contributors · Competitors cached only while this view is open")}</Text>
    </ScrollView>
  );
}
