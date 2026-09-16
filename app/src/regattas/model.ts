export interface Regatta {
  id: string;
  name: string;
  description: string;
  year: number;
  status: string;
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
  if ((row.liveBoats ?? 0) > 0) return "Live";
  if (row.firstDate && row.firstDate > today) return "Upcoming";
  if (row.status === "completed" || (row.lastDate && row.lastDate < today))
    return "Past";
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
