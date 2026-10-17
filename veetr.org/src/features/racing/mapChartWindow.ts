export type MapViewport = { south: number; north: number; west: number; east: number };
export type ChartWindow = { start: number; end: number };
type Sample = { latitude: number; longitude: number; recordedAt: string };

/** Use the time span of the visible route, including repeated visits to an area. */
export function mapChartWindow(points: readonly Sample[], viewport: MapViewport | null): ChartWindow | null {
  let start = Infinity, end = -Infinity;
  for (const point of points) {
    if (viewport) {
      const width = viewport.east - viewport.west;
      const span = width < 0 ? ((width % 360) + 360) % 360 : width;
      const longitude = ((point.longitude - viewport.west) % 360 + 360) % 360;
      if (point.latitude < viewport.south || point.latitude > viewport.north || (span < 360 && longitude > span)) continue;
    }
    const time = Date.parse(point.recordedAt);
    if (Number.isFinite(time)) { start = Math.min(start, time); end = Math.max(end, time); }
  }
  return start <= end ? { start, end } : null;
}
