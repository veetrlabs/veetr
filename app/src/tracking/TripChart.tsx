import type { MapRegion } from "../maps/headingRay";
import { chartEntries, zoomWindow, type TimeWindow } from "./chartWindow";
import { formatNumber, locale, t, useLanguageRefresh } from '../i18n';
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import type { TrackingPoint } from "./model";
import { chartPath, metricValue, nearestPoint, type Metric } from "./trip";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
const series: { key: Metric; label: string; color: string }[] = [
  { key: "sog", label: "SOG", color: "#008c80" },
  { key: "aws", label: "AWS", color: "#3182ce" },
  { key: "tws", label: "TWS", color: "#d68b27" },
];
export default function TripChart({
  points: allPoints,
  index: selectedIndex,
  onSelect: selectOriginal,
  region,
  resetKey,
  onScrubbing,
}: {
  points: TrackingPoint[];
  region?: MapRegion;
  resetKey?: number;
  index: number;
  onSelect: (index: number) => void;
  onScrubbing?: (active: boolean) => void;
}) {
  useLanguageRefresh();
  const [window, setWindow] = useState<TimeWindow>();
  // MapKit can repeat equivalent region notifications when the selected boat changes.
  // Only an actual viewport change should discard a user's chart zoom.
  const regionKey = region ? [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta].map(n => n.toFixed(6)).join(',') : '';
  useEffect(() => setWindow(undefined), [regionKey, resetKey]);
  const available = useMemo(() => chartEntries(allPoints, region), [allPoints, region]);
  const bounds: TimeWindow = [Date.parse(available[0]?.point.recordedAt || ""), Date.parse(available.at(-1)?.point.recordedAt || "")];
  const entries = useMemo(() => chartEntries(allPoints, region, window), [allPoints, region, window]);
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
  const max = useMemo(
    () =>
      points.reduce((largest, p) => active.reduce((value, s) => Math.max(value, metricValue(p, s.key) ?? 0), largest), 1),
    [points, active],
  );
  const paths = useMemo(
    () => active.map((s) => ({ ...s, path: chartPath(points, s.key, max, 320, 140, min, originalIndices, window) })),
    [points, active, max, min, originalIndices, window],
  );
  const start = window?.[0] ?? Date.parse(points[0]?.recordedAt),
    end = window?.[1] ?? Date.parse(points.at(-1)?.recordedAt || "");
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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: c.textMuted, flex: 1 }}>{window ? t("Selected time range") : region ? t("Route visible on map") : t("Whole trip")}</Text>
        {window && <Pressable accessibilityRole="button" onPress={() => setWindow(undefined)} style={{ padding: 12 }}><Text style={{ color: "#008c80" }}>{t("Reset chart")}</Text></Pressable>}
      </View>
      {!points.length && <Text style={{ color: c.textMuted }}>{t("No recorded positions in this view. Zoom out or fit the whole trip.")}</Text>}


      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Text style={{ color: c.text, fontWeight: "600" }}>{t("Speed & wind")}</Text>
        <Text style={{ color: c.textMuted, fontSize: 12 }}>{"knots"}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 22 }}>
        {active.map((s) => (
          <View key={s.key} style={{ gap: 4 }}>
            <Text style={{ color: s.color, fontSize: 12, fontWeight: "600" }}>
              ● {s.label}
            </Text>
            <Text
              style={{
                color: c.text,
                fontSize: 23,
                fontWeight: "600",
                fontVariant: ["tabular-nums"],
              }}
            >
              {point && metricValue(point, s.key) !== null
                ? formatNumber(metricValue(point, s.key)!, 1)
                : "—"}
            </Text>
          </View>
        ))}
      </View>
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
        style={{ height: 180, paddingLeft: 32, paddingRight: 12 }}
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
          height={160}
          viewBox="0 -10 320 160"
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
          {paths.map((s) => (
            <Path
              key={s.key}
              d={s.path}
              fill="none"
              stroke={s.color}
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
            active.map(
              (s) =>
                metricValue(point, s.key) !== null && (
                  <Circle
                    key={s.key}
                    cx={x}
                    cy={140 - (140 * (metricValue(point, s.key)! - min)) / (max - min)}
                    r={3.5}
                    fill={s.color}
                  />
                ),
            )}
        </Svg>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
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
        {point
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
      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: "center" }}>
        {t("Heading is magnetic; course is true. Wind wedges require a recorded heading.")}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: "center" }}>
        {t("Pinch to zoom the chart. Slide to explore your trip.")}</Text>
      {!points.some((p) =>
        active.some((s) => metricValue(p, s.key) !== null),
      ) && (
        <Text style={{ color: c.textMuted, fontSize: 13 }}>
          {t("No speed measurements were saved. You can still explore the recorded positions.")}</Text>
      )}
    </View>
  );
}
