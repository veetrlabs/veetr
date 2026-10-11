import type { TrackingPoint } from "./model";
import { chartPath, metricValue, TRACK_GAP_MS, type Metric } from "./trip";
import { chartEntries, type TimeWindow } from "./chartWindow";
import type { BoatTrack } from "../replay/boatTracks";

export const chartMetrics: { key: Metric; label: string; color: string; dash?: string }[] = [
  { key: "sog", label: "SOG", color: "#008c80" },
  { key: "aws", label: "AWS", color: "#3182ce", dash: "8 4" },
  { key: "tws", label: "TWS", color: "#d68b27", dash: "2 4" },
];

export function boatReadingAt(track: BoatTrack, at: number) {
  const latest = track.points.findLast(point => Date.parse(point.recordedAt) <= at);
  return latest && at - Date.parse(latest.recordedAt) <= TRACK_GAP_MS ? latest : undefined;
}

export function fleetChartSeries(tracks: BoatTrack[], bounds: TimeWindow, at: number) {
  const series = tracks.flatMap(track => {
    const entries = chartEntries(track.points, bounds);
    const points = entries.map(entry => entry.point);
    // Do not show future samples or carry stale readings through recording gaps.
    const point = boatReadingAt(track, at);
    return chartMetrics.filter(metric => metric.key === "sog" || track.points.some(p => metricValue(p, metric.key) !== null))
      .map(metric => ({
        id: track.id + ":" + metric.key,
        key: metric.key,
        label: track.name + " · " + metric.label,
        color: track.color,
        dash: metric.dash,
        points,
        indices: entries.map(entry => entry.index),
        point,
      }));
  });
  const max = series.reduce((max, s) => s.points.reduce((max, point) => Math.max(max, metricValue(point, s.key) ?? 0), max), 1);
  return {
    max,
    series: series.map(s => ({
      ...s,
      path: chartPath(s.points, s.key, max, 320, 140, 0, s.indices, bounds),
      value: s.point ? metricValue(s.point, s.key) : null,
    })),
  };
}
