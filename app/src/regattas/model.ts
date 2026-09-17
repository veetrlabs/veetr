import { eventsFor, type Series } from "../../../veetr.org/src/features/racing/domain";
export interface Regatta {
  id: string;
  name: string;
  description: string;
  year: number;
  status: string;
  completed?: boolean;
  raceCount: number;
  boatCount: number;
  firstDate?: string;
  lastDate?: string;
  liveBoats?: number;
  replayStart?: string;
  replayEnd?: string;
}
export type RegattaFilter = "All" | "Live" | "Upcoming" | "Past";
export function regattaState(
  row: Regatta,
  today = new Date().toISOString().slice(0, 10),
): Exclude<RegattaFilter, "All"> | "Scheduled" {
  if (row.completed || row.status === "completed") return "Past";
  if ((row.liveBoats ?? 0) > 0) return "Live";
  if (row.firstDate && row.firstDate > today) return "Upcoming";
  if (row.status === "completed" || (row.lastDate && row.lastDate < today))
    return "Past";
  if (row.firstDate && row.firstDate <= today && (row.lastDate || row.firstDate) >= today) return "Live";
  return "Scheduled";
}
export function replayStep(
  at: number,
  delta: number,
  start: number,
  end: number,
) {
  return Math.max(start, Math.min(end, at + delta));
}

// The public directory is series-based; the mobile browser shows its published events.
export interface RaceRegatta extends Regatta {
  seriesId: string;
  eventId: string;
  boatIds: string[];
  completed: boolean;
}

export function publishedRaceRegattas(directory: Regatta, series: Series): RaceRegatta[] {
  const published = { ...series, races: (series.races ?? []).filter(r => r.status === "published" || r.status === "locked") };
  const events = eventsFor(published);
  return events.sort((a, b) => a.order - b.order).flatMap(event => {
    const heats = published.races.filter(r => (r.eventId ?? r.id) === event.id);
    if (!heats.length) return [];
    const dates = heats.map(r => r.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || "")).sort();
    const boatIds = [...new Set(heats.flatMap(r => r.entries))];
    // Tracking currently belongs to a series. Never attach another event's track
    // to this race: attribution is unambiguous only for a single-event series.
    const tracking = events.length === 1 ? {
      liveBoats: event.completed ? 0 : directory.liveBoats,
      replayStart: directory.replayStart,
      replayEnd: directory.replayEnd,
    } : {};
    return [{
      id: `${series.id}/${event.id}`, seriesId: series.id, eventId: event.id,
      name: event.name, description: "", year: series.year,
      status: event.completed ? "completed" : "active", completed: event.completed,
      raceCount: heats.length, boatCount: boatIds.length, boatIds,
      firstDate: dates[0], lastDate: dates.at(-1), ...tracking,
    }];
  });
}
