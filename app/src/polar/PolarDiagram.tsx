import {
  fullPolarViewport,
  pinchViewport,
  touchGeometry,
  type PolarViewport,
} from "./viewport";
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  type GestureResponderEvent,
} from "react-native";
import { t, formatNumber } from "../i18n";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import {
  polarCurve,
  polarXY,
  polarWindColor,
  polarWindSpeeds,
} from "../../../packages/shared/src/polar/diagram";
import type { Polar } from "../../../packages/shared/src/polar/model";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function PolarDiagram({
  polar,
  actual,
  measured,
  comparisons = [],
  onInteractionChange,
}: {
  onInteractionChange?: (active: boolean) => void;
  polar?: Polar;
  comparisons?: { polar: Polar; dash: string }[];
  measured?: Polar;
  actual?: { twa: number; speed: number };
}) {
  const c = themeColors[useTheme().theme];
  const overlays = [
    ...(measured ? [{ polar: measured, dash: "6 4" }] : []),
    ...comparisons,
  ];
  const winds = polarWindSpeeds(polar, ...overlays.map((entry) => entry.polar));
  const [width, setWidth] = useState(320),
    [viewport, setViewport] = useState(fullPolarViewport);
  const viewportRef = useRef(viewport),
    surface = useRef<View>(null),
    origin = useRef({ x: 0, y: 0 });
  const gesture = useRef<{
    from: ReturnType<typeof touchGeometry>;
    viewport: PolarViewport;
  } | null>(null);
  const active = useRef(false),
    moved = useRef(false),
    pinched = useRef(false),
    lastTap = useRef(0);
  const zoom = viewport.zoom,
    size = 320 / zoom;
  const commit = (next: PolarViewport) => {
    viewportRef.current = next;
    setViewport(next);
  };
  const geometry = (event: GestureResponderEvent) =>
    touchGeometry(
      Array.from(event.nativeEvent.touches)
        .slice(0, 2)
        .map((touch) => ({
          x: touch.pageX - origin.current.x,
          y: touch.pageY - origin.current.y,
        })),
    );
  const finish = () => {
    active.current = false;
    gesture.current = null;
    onInteractionChange?.(false);
  };
  useEffect(() => () => {
    active.current = false;
    gesture.current = null;
    onInteractionChange?.(false);
  }, [onInteractionChange]);
  const claim = (event: GestureResponderEvent) =>
    event.nativeEvent.touches.length >= 2 || viewportRef.current.zoom > 1;
  const begin = (event: GestureResponderEvent) => {
    active.current = true;
    onInteractionChange?.(true);
    moved.current = false;
    pinched.current = event.nativeEvent.touches.length >= 2;
    const touches = Array.from(event.nativeEvent.touches).map((touch) => ({
      pageX: touch.pageX,
      pageY: touch.pageY,
    }));
    const initialize = (x: number, y: number) => {
      if (!active.current) return;
      origin.current = { x, y };
      gesture.current = {
        viewport: viewportRef.current,
        from: touchGeometry(
          touches.map((touch) => ({ x: touch.pageX - x, y: touch.pageY - y })),
        ),
      };
    };
    if (surface.current?.measureInWindow)
      surface.current.measureInWindow(initialize);
    else initialize(0, 0);
  };
  const move = (event: GestureResponderEvent) => {
    if (!active.current || !event.nativeEvent.touches.length) return;
    const next = geometry(event),
      start = gesture.current;
    if (!start || start.from.count !== next.count) {
      gesture.current = { from: next, viewport: viewportRef.current };
      if (next.count === 2) pinched.current = true;
      return;
    }
    if (
      Math.hypot(next.x - start.from.x, next.y - start.from.y) > 3 ||
      Math.abs(next.distance - start.from.distance) > 3
    )
      moved.current = true;
    commit(pinchViewport(start.viewport, start.from, next, width));
  };
  const release = () => {
    if (!active.current) return;
    if (!moved.current && !pinched.current) {
      const now = Date.now();
      if (lastTap.current && now - lastTap.current < 300) {
        commit(fullPolarViewport);
        lastTap.current = 0;
      } else lastTap.current = now;
    } else lastTap.current = 0;
    finish();
  };

  const [hidden, setHidden] = useState<number[]>([]);
  const visible = winds.filter((w) => !hidden.includes(w));

  const max = Math.ceil(
      [
        ...(polar ? [polar] : []),
        ...overlays.map((entry) => entry.polar),
      ].reduce(
        (largest, curve) =>
          curve.points.reduce((n, p) => Math.max(n, p.speed), largest),
        Math.max(1, actual?.speed ?? 0),
      ),
    ),
    scale = 130 / max;
  const point = actual ? polarXY(actual.twa, actual.speed, scale) : undefined;
  return (
    <View
      style={{ gap: 12 }}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0) setWidth(next);
      }}
    >
      <View
        ref={surface}
        collapsable={false}
        testID="polar-gesture-surface"
        onStartShouldSetResponderCapture={claim}
        onMoveShouldSetResponderCapture={claim}
        onStartShouldSetResponder={claim}
        onMoveShouldSetResponder={claim}
        onResponderGrant={begin}
        onResponderMove={move}
        onResponderEnd={(event) => {
          if (!active.current) return;
          if (event.nativeEvent.touches.length) {
            gesture.current = {
              from: geometry(event),
              viewport: viewportRef.current,
            };
          } else release();
        }}
        onResponderRelease={release}
        onResponderTerminate={finish}
        onTouchCancel={finish}
        onResponderTerminationRequest={() => !active.current}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t("Polar diagram")}
        accessibilityHint={t(
          "Pinch to zoom. Drag to move when zoomed. Double-tap to reset.",
        )}
        accessibilityValue={{ min: 100, max: 400, now: Math.round(zoom * 100), text: `${Math.round(zoom * 100)}%` }}
        accessibilityActions={[
          { name: "increment", label: t("Zoom in") },
          { name: "decrement", label: t("Zoom out") },
          { name: "reset", label: t("Reset zoom") },
        ]}
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          if (action === "reset") commit(fullPolarViewport);
          else {
            const current = viewportRef.current;
            const center = {
              x: width / 2,
              y: width / 2,
              count: 2,
              distance: 100,
            };
            commit(
              pinchViewport(
                current,
                center,
                {
                  ...center,
                  distance: action === "increment" ? 150 : 100 / 1.5,
                },
                width,
              ),
            );
          }
        }}
        style={{ height: width, overflow: "hidden" }}
      >
        <Svg
          pointerEvents="none"
          accessibilityLabel={`${t("Polar diagram")}: ${visible.map((w) => `${formatNumber(w)} kn`).join(", ")}`}
          width="100%"
          height={width}
          viewBox={`${viewport.x} ${viewport.y} ${size} ${size}`}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <Circle
              key={f}
              cx={160}
              cy={160}
              r={130 * f}
              fill="none"
              stroke={c.border}
            />
          ))}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const p = polarXY(a, max, scale);
            return (
              <Line
                key={a}
                x1={160}
                y1={160}
                x2={p.x}
                y2={p.y}
                stroke={c.border}
              />
            );
          })}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <SvgText
              key={f}
              x={164}
              y={160 - 130 * f}
              fill={c.textMuted}
              fontSize={10}
            >
              {(max * f).toFixed(1)} kn
            </SvgText>
          ))}
          <SvgText x={160} y={15} textAnchor="middle" fill={c.textMuted}>
            0°
          </SvgText>
          <SvgText x={306} y={164} textAnchor="middle" fill={c.textMuted}>
            90°
          </SvgText>
          <SvgText x={160} y={310} textAnchor="middle" fill={c.textMuted}>
            180°
          </SvgText>
          {polar &&
            visible.map((wind) => (
              <Path
                key={`reference:${wind}`}
                d={polarCurve(polar, wind, scale)}
                stroke={polarWindColor(wind, winds)}
                strokeWidth={2.5 / zoom}
                fill="none"
                strokeDasharray={polar.source === "learned" ? "6 4" : undefined}
              />
            ))}
          {overlays.flatMap((entry) =>
            visible.map((wind) => (
              <Path
                key={`${entry.polar.id}:${wind}`}
                d={polarCurve(entry.polar, wind, scale)}
                stroke={polarWindColor(wind, winds)}
                strokeWidth={2.5 / zoom}
                strokeDasharray={entry.dash
                  .split(" ")
                  .map(Number)
                  .map((value) => value / zoom)
                  .join(" ")}
                fill="none"
              />
            )),
          )}
          {[
            ...(polar?.source === "learned" ? [polar] : []),
            ...overlays.map((entry) => entry.polar),
          ].flatMap((curve) =>
            curve.points
              .filter(
                (p) =>
                  visible.includes(p.tws) && p.confidence?.level !== "unknown",
              )
              .flatMap((p) =>
                [-p.twa, p.twa].map((angle) => {
                  const xy = polarXY(angle, p.speed, scale);
                  return (
                    <Circle
                      key={`${curve.id}:${p.tws}:${angle}`}
                      cx={xy.x}
                      cy={xy.y}
                      r={1.8 / zoom}
                      fill={polarWindColor(p.tws, winds)}
                    />
                  );
                }),
              ),
          )}
          {point && <Circle cx={point.x} cy={point.y} r={5} fill="#f59e0b" />}
        </Svg>
      </View>
      <Text style={{ color: c.textMuted }}>
        {t("Pinch to zoom. Drag to move when zoomed. Double-tap to reset.")}
      </Text>
      <Text style={{ color: c.text }}>{t("Wind speeds")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {winds.map((wind) => {
          const checked = !hidden.includes(wind),
            color = polarWindColor(wind, winds);
          return (
            <Pressable
              key={wind}
              accessible
              accessibilityRole="checkbox"
              accessibilityLabel={`${formatNumber(wind)} kn`}
              accessibilityState={{ checked }}
              onPress={() =>
                setHidden((previous) =>
                  previous.includes(wind)
                    ? previous.filter((w) => w !== wind)
                    : [...previous, wind],
                )
              }
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderWidth: 2,
                borderColor: checked ? color : "transparent",
                borderRadius: 24,
                backgroundColor: checked ? c.buttonBg : c.bg,
                opacity: pressed ? 0.65 : 1,
                flexDirection: "row",
                alignItems: "center",
              })}
            >
              <Text
                style={{
                  color: checked ? color : c.textMuted,
                  fontWeight: "600",
                }}
              >
                {formatNumber(wind)} kn
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!visible.length && (
        <Text style={{ color: c.textMuted }}>
          {t("Select a wind speed to show its curve.")}
        </Text>
      )}
      {!!overlays.length && (
        <Text style={{ color: c.textMuted }}>
          {t("Solid lines: expected speed. Dashed lines: measured speed.")}
        </Text>
      )}
    </View>
  );
}
