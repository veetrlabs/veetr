import type { PropulsionSection } from "./propulsion";
import { chartEntries, zoomWindow, type TimeWindow } from "./chartWindow";
import type { MapRegion } from '../maps/headingRay';
import { formatNumber, locale, t, useLanguageRefresh } from '../i18n';
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import type { TrackingPoint } from "./model";
import { chartPath, metricValue, nearestPoint } from "./trip";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { chartMetrics as series, fleetChartSeries } from "./chartSeries";
import type { BoatTrack } from "../replay/boatTracks";
export default function TripChart({
  points: allPoints,
  index: selectedIndex,
  onSelect: selectOriginal,
  onScrubbing,
  boatTracks,
  region,
  sections,
  renderSections,
}: {
  points: TrackingPoint[];
  boatTracks?: BoatTrack[];
  region?: MapRegion;
  sections?: PropulsionSection[];
  renderSections?: (range: [number, number]) => ReactNode;
  index: number;
  onSelect: (index: number) => void;
  onScrubbing?: (active: boolean) => void;
}) {
  useLanguageRefresh();
  // Equivalent MapKit callbacks must not cancel a chart pinch zoom.
  const regionKey = region ? [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta].map(n => n.toFixed(6)).join(',') : '';
  const [zoom, setZoom] = useState<{ regionKey: string; window: TimeWindow }>();
  useEffect(() => setZoom(undefined), [regionKey]);
  const window = zoom?.regionKey === regionKey ? zoom.window : undefined;
  const setWindow = (window: TimeWindow | undefined) => setZoom(window ? { regionKey, window } : undefined);
  const available = useMemo(() => chartEntries(allPoints, undefined, region), [allPoints, region]);
  const bounds: TimeWindow = [Date.parse(available[0]?.point.recordedAt || ""), Date.parse(available.at(-1)?.point.recordedAt || "")];
  const entries = useMemo(() => chartEntries(allPoints, window, region), [allPoints, window, region]);
  const points = useMemo(() => entries.map(e => e.point), [entries]);
  const originalIndices = useMemo(() => entries.map(e => e.index), [entries]);
  const index = originalIndices.indexOf(selectedIndex);
  useEffect(() => {
    if (index < 0 && entries.length) selectOriginal(entries[0].index);
  }, [entries, index, selectOriginal]);
  const onSelect = (i: number) => { if (entries[i]) selectOriginal(entries[i].index); };
  const pinch = useRef<{ distance: number; window: TimeWindow; anchor: number } | null>(null);
  const wasPinching = useRef(false);

  const displayed = series;
  const min = 0;
  const { theme } = useTheme(),
    c = themeColors[theme],
    [width, setWidth] = useState(300);
  const chartRef = useRef<View>(null);
  const chartLeft = useRef(0);
  const active = useMemo(
    () =>
      displayed.filter(
        (s) =>
          s.key === "sog" || points.some((p) => metricValue(p, s.key) !== null),
      ),
    [points],
  );
  const singleMax = useMemo(
    () =>
      points.reduce((largest, p) => active.reduce((value, s) => Math.max(value, metricValue(p, s.key) ?? 0), largest), 1),
    [points, active],
  );
  const start = window?.[0] ?? Date.parse(points[0]?.recordedAt),
    end = window?.[1] ?? Date.parse(points.at(-1)?.recordedAt || "");
  const fleet = useMemo(() => boatTracks ? fleetChartSeries(boatTracks, [start, end], Date.parse(allPoints[selectedIndex]?.recordedAt)) : undefined,
    [boatTracks, start, end, allPoints, selectedIndex]);
  const max = fleet?.max ?? singleMax;
  const paths = useMemo(() => fleet?.series ?? active.map(s => ({
    ...s, id: s.key, dash: undefined,
    value: points[index] ? metricValue(points[index], s.key) : null,
    path: chartPath(points, s.key, max, 320, 140, min, originalIndices, window),
  })), [fleet, active, points, index, max, min, originalIndices, window]);
  const point = points[index],
    x = point
      ? (320 * (Date.parse(point.recordedAt) - start)) /
        Math.max(1, end - start)
      : 0;
  function select(locationX: number) {
    if (!points.length) return;
    onSelect(
      nearestPoint(
        points,
        start +
          Math.max(0, Math.min(1, (locationX - 32) / Math.max(1, width - 44))) *
            (end - start),
      ),
    );
  }
  const time = (stamp: string) =>
    new Date(stamp).toLocaleTimeString(locale(), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  return (
    <View style={{ gap: 12 }}>
      {window && <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: c.textMuted, flex: 1 }}>{t("Selected time range")}</Text>
        {window && <Pressable accessibilityRole="button" onPress={() => setWindow(undefined)} style={{ padding: 12 }}><Text style={{ color: "#008c80" }}>{t("Reset chart")}</Text></Pressable>}
      </View>}
      {boatTracks?.length === 0 && <Text style={{ color: c.textMuted }}>{t("Turn on a boat to compare its instruments.")}</Text>}
      {!points.length && <Text style={{ color: c.textMuted }}>{t(region ? "No recorded positions in this view. Zoom out or fit the whole trip." : "No recorded positions in this time range.")}</Text>}


      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'right' }}>{"knots"}</Text>
      {boatTracks ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {series.filter(metric => paths.some(path => path.key === metric.key)).map(metric => (
            <Text key={metric.key} style={{ color: c.textMuted, fontSize: 12 }}>
              {metric.dash ? metric.key === "aws" ? "┄" : "┈" : "━"} {metric.label}
            </Text>
          ))}
        </View>
      ) : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 22 }}>
        {paths.map((s) => (
          <View key={s.id} style={{ gap: 4 }}>
            <Text style={{ color: s.color, fontSize: 12, fontWeight: "600" }}>
              {s.dash ? "┄" : "●"} {s.label}
            </Text>
            <Text
              style={{
                color: c.text,
                fontSize: 23,
                fontWeight: "600",
                fontVariant: ["tabular-nums"],
              }}
            >
              {s.value !== null
                ? formatNumber(s.value, 1)
                : "—"}
            </Text>
          </View>
        ))}
      </View>}
      <View>
      <View
        ref={chartRef}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          chartRef.current?.measureInWindow((x) => {
            chartLeft.current = x;
          });
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          wasPinching.current = false;
          pinch.current = null;
          onScrubbing?.(true);
          const pageX = e.nativeEvent.pageX;
          chartRef.current?.measureInWindow((x) => {
            chartLeft.current = x;
            select(pageX - x);
          });
        }}
        onResponderMove={(e) => {
          const touches = e.nativeEvent.touches || [];
          if (touches.length >= 2) {
            const distance = Math.hypot(touches[1].pageX - touches[0].pageX, touches[1].pageY - touches[0].pageY);
            if (available.length < 2 || !distance) return;
            wasPinching.current = true;
            if (!pinch.current) pinch.current = { distance, window: window || bounds,
              anchor: Math.max(0, Math.min(1, ((touches[0].pageX + touches[1].pageX) / 2 - chartLeft.current - 32) / Math.max(1, width - 44))) };
            setWindow(zoomWindow(bounds, pinch.current.window, distance / pinch.current.distance, pinch.current.anchor));
          } else if (!wasPinching.current) select(e.nativeEvent.pageX - chartLeft.current);
        }}
        onResponderRelease={(e) => {
          if (!wasPinching.current) select(e.nativeEvent.pageX - chartLeft.current);
          pinch.current = null;
          onScrubbing?.(false);
        }}
        onResponderTerminate={() => onScrubbing?.(false)}
        onResponderTerminationRequest={() => false}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t("Trip timeline. Swipe to explore recorded positions.")}
        accessibilityValue={{
          min: 0,
          max: Math.max(0, points.length - 1),
          now: Math.max(0, index),
          text: point ? time(point.recordedAt) : t("No samples"),
        }}
        accessibilityActions={[
          { name: "increment", label: t("Next position") },
          { name: "decrement", label: t("Previous position") },
        ]}
        onAccessibilityAction={(e) =>
          onSelect(
            Math.max(
              0,
              Math.min(
                points.length - 1,
                index + (e.nativeEvent.actionName === "increment" ? 1 : -1),
              ),
            ),
          )
        }
        style={{ height: 150, paddingLeft: 32, paddingRight: 12 }}
      >
        {[0, 0.5, 1].map((t) => (
          <Text
            key={t}
            style={{
              position: "absolute",
              left: 0,
              top: 10 + t * 140 - 7,
              color: c.textMuted,
              fontSize: 10,
            }}
          >
            {formatNumber((max - (max - min) * t), max < 2 ? 1 : 0)}
          </Text>
        ))}
        <Svg
          pointerEvents="none"
          width="100%"
          height={150}
          viewBox="0 -10 320 150"
          preserveAspectRatio="none"
        >
          {[0, 70, 140].map((y) => (
            <Line
              key={y}
              x1={0}
              x2={320}
              y1={y}
              y2={y}
              stroke={c.border}
              strokeDasharray="3 4"
            />
          ))}
          {sections?.slice(1).map(section => {
            const at = Date.parse(section.startedAt);
            if (at < start || at > end) return null;
            const x = 320 * (at - start) / Math.max(1, end - start);
            return <Line key={section.startedAt} x1={x} x2={x} y1={0} y2={140} stroke={c.text} strokeDasharray="2 3" strokeWidth={1} />;
          })}
          {paths.map((s) => (
            <Path
              key={s.id}
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeDasharray={s.dash}
              strokeWidth={2}
            />
          ))}
          {point && (
            <Line
              x1={x}
              x2={x}
              y1={0}
              y2={140}
              stroke={c.textMuted}
              strokeDasharray="3 3"
            />
          )}
          {point &&
            paths.map(
              (s) =>
                s.value !== null && (
                  <Circle
                    key={s.id}
                    cx={x}
                    cy={140 - (140 * (s.value! - min)) / (max - min)}
                    r={3.5}
                    fill={s.color}
                  />
                ),
            )}
        </Svg>
      </View>
      {renderSections?.([start, end])}
        <View style={{ marginLeft: 32, marginRight: 12, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: c.textMuted, fontSize: 10 }}>
            {points.length ? time(new Date(start).toISOString()) : ""}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 10 }}>
            {points.length ? time(new Date(end).toISOString()) : ""}
          </Text>
        </View>
      </View>
      <Text
        style={{
          color: c.text,
          fontSize: 13,
          textAlign: "center",
          fontVariant: ["tabular-nums"],
        }}
      >
        {point ? time(point.recordedAt) : t("No recorded positions")}
        {point && !boatTracks
          ? ` · ${formatNumber(point.latitude, 5)}, ${formatNumber(point.longitude, 5)}`
          : ""}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
        {[
          { label: "HDG", name: "Heading", color: "#000000", wedge: false, dashed: false },
          { label: "COG", name: "Course over ground", color: "#2563eb", wedge: false, dashed: true },
          { label: "AWA", name: "Apparent wind", color: "#3182ce", wedge: true, dashed: false },
          { label: "TWA", name: "True wind", color: "#d68b27", wedge: true, dashed: false },
        ].map(item => (
          <View key={item.label} accessible accessibilityLabel={t(item.name)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Svg width={32} height={16} viewBox="0 0 32 16" accessible={false}>
              {item.wedge ? <Path d="M 2 8 L 30 3 L 30 13 Z" fill={item.color} />
                : <Line x1={1} y1={8} x2={31} y2={8} stroke={item.color} strokeWidth={1} strokeDasharray={item.dashed ? "6 4" : undefined} />}
            </Svg>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>{item.label}</Text>
          </View>
        ))}
      </View>
      {(boatTracks ? boatTracks.length > 0 && !boatTracks.some(boat => boat.points.some(p => series.some(s => metricValue(p, s.key) !== null)))
        : !points.some(p => active.some(s => metricValue(p, s.key) !== null))) && (
        <Text style={{ color: c.textMuted, fontSize: 13 }}>
          {t("No speed measurements were saved. You can still explore the recorded positions.")}</Text>
      )}
    </View>
  );
}
