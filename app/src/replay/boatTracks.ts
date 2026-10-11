import type { TrackingPoint } from "../tracking/model";

export type BoatTrack = {
  id: string;
  name: string;
  color: string;
  points: TrackingPoint[];
};

const colors = ["#009688", "#3182ce", "#d68b27", "#a855f7", "#e05070", "#799c28", "#b87542", "#568fa8"];

export function boatColor(id: string, used: Iterable<string> = []) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const taken = new Set(used);
  for (let i = 0; i < colors.length; i++) {
    const color = colors[(hash + i) % colors.length];
    if (!taken.has(color)) return color;
  }
  return colors[hash % colors.length];
}
