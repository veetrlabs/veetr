import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import {
  polarCurve,
  polarXY,
} from "../../../packages/shared/src/polar/diagram";
import type { Polar } from "../../../packages/shared/src/polar/model";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function PolarDiagram({
  polar,
  tws,
  actual,
}: {
  polar: Polar;
  tws: number;
  actual?: { twa: number; speed: number };
}) {
  const c = themeColors[useTheme().theme];
  const max = Math.ceil(
      Math.max(1, ...polar.points.map((p) => p.speed), actual?.speed ?? 0),
    ),
    scale = 130 / max;
  const point = actual ? polarXY(actual.twa, actual.speed, scale) : undefined;
  return (
    <Svg
      accessibilityLabel={`Polar, ${tws} kn true wind`}
      width="100%"
      height={320}
      viewBox="0 0 320 320"
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
          <Line key={a} x1={160} y1={160} x2={p.x} y2={p.y} stroke={c.border} />
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
      <Path
        d={polarCurve(polar, tws, scale)}
        stroke="#14b8a6"
        strokeWidth={3}
        fill="none"
      />
      {point && <Circle cx={point.x} cy={point.y} r={5} fill="#f59e0b" />}
    </Svg>
  );
}
