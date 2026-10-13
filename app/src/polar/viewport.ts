export type PolarViewport = { zoom: number; x: number; y: number };
export const fullPolarViewport: PolarViewport = { zoom: 1, x: 0, y: 0 };
export type ChartTouch = { x: number; y: number };
export function touchGeometry(touches: ChartTouch[]) {
  const a = touches[0],
    b = touches[1] ?? a;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    count: Math.min(2, touches.length),
  };
}
export function pinchViewport(
  start: PolarViewport,
  from: ReturnType<typeof touchGeometry>,
  to: ReturnType<typeof touchGeometry>,
  width: number,
): PolarViewport {
  const zoom = Math.max(
    1,
    Math.min(
      4,
      start.zoom *
        (from.count === 2 && from.distance > 0
          ? to.distance / from.distance
          : 1),
    ),
  );
  const size = 320 / zoom,
    oldSize = 320 / start.zoom;
  const x = start.x + (from.x * oldSize) / width - (to.x * size) / width;
  const y = start.y + (from.y * oldSize) / width - (to.y * size) / width;
  return {
    zoom,
    x: Math.max(0, Math.min(320 - size, x)),
    y: Math.max(0, Math.min(320 - size, y)),
  };
}
