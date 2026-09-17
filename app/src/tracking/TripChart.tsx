import { useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
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
  points,
  index,
  onSelect,
  onScrubbing,
}: {
  points: TrackingPoint[];
  index: number;
  onSelect: (index: number) => void;
  onScrubbing?: (active: boolean) => void;
}) {
  const { theme } = useTheme(),
    c = themeColors[theme],
    [width, setWidth] = useState(300);
  const chartRef = useRef<View>(null);
  const chartLeft = useRef(0);
  const active = useMemo(
    () =>
      series.filter(
        (s) =>
          s.key === "sog" || points.some((p) => metricValue(p, s.key) !== null),
      ),
    [points],
  );
  const max = useMemo(
    () =>
      Math.max(
        1,
        ...points.flatMap((p) => active.map((s) => metricValue(p, s.key) ?? 0)),
      ),
    [points, active],
  );
  const paths = useMemo(
    () => active.map((s) => ({ ...s, path: chartPath(points, s.key, max) })),
    [points, active, max],
  );
  const start = Date.parse(points[0]?.recordedAt),
    end = Date.parse(points.at(-1)?.recordedAt || "");
  const point = points[index],
    x = point
      ? (320 * (Date.parse(point.recordedAt) - start)) /
        Math.max(1, end - start)
      : 0;
  function select(locationX: number) {
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
    new Date(stamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Text style={{ color: c.text, fontWeight: "600" }}>Speed & wind</Text>
        <Text style={{ color: c.textMuted, fontSize: 12 }}>knots</Text>
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
                ? metricValue(point, s.key)!.toFixed(1)
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
          onScrubbing?.(true);
          const pageX = e.nativeEvent.pageX;
          chartRef.current?.measureInWindow((x) => {
            chartLeft.current = x;
            select(pageX - x);
          });
        }}
        onResponderMove={(e) => {
          select(e.nativeEvent.pageX - chartLeft.current);
        }}
        onResponderRelease={(e) => {
          select(e.nativeEvent.pageX - chartLeft.current);
          onScrubbing?.(false);
        }}
        onResponderTerminate={() => onScrubbing?.(false)}
        onResponderTerminationRequest={() => false}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Trip timeline. Swipe to explore recorded positions."
        accessibilityValue={{
          min: 0,
          max: Math.max(0, points.length - 1),
          now: Math.max(0, index),
          text: point ? time(point.recordedAt) : "No samples",
        }}
        accessibilityActions={[
          { name: "increment", label: "Next position" },
          { name: "decrement", label: "Previous position" },
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
            {(max * (1 - t)).toFixed(max < 2 ? 1 : 0)}
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
                    cy={140 - (140 * metricValue(point, s.key)!) / max}
                    r={3.5}
                    fill={s.color}
                  />
                ),
            )}
        </Svg>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: c.textMuted, fontSize: 10 }}>
            {points.length ? time(points[0].recordedAt) : ""}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 10 }}>
            {points.length ? time(points[points.length - 1].recordedAt) : ""}
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
        {point ? time(point.recordedAt) : "No recorded positions"}
        {point
          ? ` · ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
          : ""}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: "center" }}>
        Slide over the chart to explore your trip.
      </Text>
      {!points.some((p) =>
        active.some((s) => metricValue(p, s.key) !== null),
      ) && (
        <Text style={{ color: c.textMuted, fontSize: 13 }}>
          No speed measurements were saved. You can still explore the recorded
          positions.
        </Text>
      )}
    </View>
  );
}
