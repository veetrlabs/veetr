import { targetSpeed } from "./engine";
import type { Polar } from "./model";
export function polarXY(angle: number, speed: number, scale: number) {
  const r = (angle * Math.PI) / 180;
  return {
    x: 160 + Math.sin(r) * speed * scale,
    y: 160 - Math.cos(r) * speed * scale,
  };
}
export function polarCurve(polar: Polar, tws: number, scale: number) {
  let path = "",
    open = false;
  for (let angle = -180; angle <= 180; angle += 2) {
    const speed = targetSpeed(polar, tws, angle);
    if (speed === null) {
      open = false;
      continue;
    }
    const p = polarXY(angle, speed, scale);
    path += `${open ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)} `;
    open = true;
  }
  return path;
}

/** Stable colors use the full wind range, never the currently visible subset. */
export function polarWindColor(wind: number, winds: number[]) {
  const min = Math.min(...winds),
    max = Math.max(...winds);
  const fraction =
    max > min ? Math.max(0, Math.min(1, (wind - min) / (max - min))) : 0;
  return `hsl(${Math.round(240 * (1 - fraction))}, 80%, 48%)`;
}
export function polarWindSpeeds(...polars: (Polar | undefined)[]) {
  return [
    ...new Set(
      polars.flatMap((p) => p?.points.map((point) => point.tws) ?? []),
    ),
  ].sort((a, b) => a - b);
}
