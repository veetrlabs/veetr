import {
  calculateSeriesStandings,
  defaultPolicy,
  type Result,
  type Race,
} from "../../../../packages/scoring/src/index";
export interface Category {
  id: string;
  name: string;
}
export interface Boat {
  id: string;
  name: string;
  sailNumber: string;
  skipper?: string;
  crewNames?: string;
  publishCrew?: boolean;
  className: string;
  length?: number;
  categoryId: string;
}
export interface DiscardRule {
  from: number;
  discard: number;
}
export interface RaceEvent {
  scheduledStart?: string;
  id: string;
  name: string;
  order: number;
  weight: number;
  completed: boolean;
  discards: DiscardRule[];
  entries?: string[];
  countAs?: number;
  scheduleStatus?: "Cancelled" | "Upcoming" | "Awaiting results";
}
export interface ControlRace extends Race {
  eventId?: string;
  kind?: "aggregate";
  name: string;
  date: string;
  status: "draft" | "published" | "locked";
  results: Result[];
}
export interface Series {
  id: string;
  name: string;
  year: number;
  description: string;
  status: "draft" | "active" | "completed";
  categories: Category[];
  boats: Boat[];
  races: ControlRace[];
  events?: RaceEvent[];
  discards?: DiscardRule[];
  pointsStart?: 0 | 1;
}
export const id = () => crypto.randomUUID();
export function newSeries(
  name = "Untitled series",
  year = new Date().getFullYear(),
): Series {
  return {
    id: id(),
    name,
    year,
    description: "",
    status: "draft",
    categories: ["≤ 7 m", "> 7 m", "Race"].map((name) => ({ id: id(), name })),
    boats: [],
    races: [],
  };
}
export function normalize(race: ControlRace, boats: Boat[]): void {
  for (const category of new Set(boats.map((b) => b.categoryId))) {
    race.results
      .filter(
        (r) =>
          r.status === "FINISHED" &&
          boats.find((b) => b.id === r.boatId)?.categoryId === category,
      )
      .forEach((r, i) => (r.position = i + 1));
  }
}
export function setFinish(
  race: ControlRace,
  boats: Boat[],
  boatId: string,
  status: Result["status"],
) {
  if (!race.entries.includes(boatId)) throw new Error("Boat is not registered");
  const recordedOrder =
    Math.max(0, ...race.results.map((r, i) => r.recordedOrder ?? i + 1)) + 1;
  race.results = race.results.filter((r) => r.boatId !== boatId);
  race.results.push({
    boatId,
    status,
    recordedOrder,
    ...(status === "FINISHED" ? { finishedAt: new Date().toISOString() } : {}),
  });
  normalize(race, boats);
}

export function validateDiscardRules(rules: DiscardRule[] = []) {
  if (
    !Array.isArray(rules) ||
    rules.some(
      (r, i) =>
        !Number.isInteger(r.from) ||
        r.from < 1 ||
        !Number.isInteger(r.discard) ||
        r.discard < 0 ||
        r.discard >= r.from ||
        rules.some((v, j) => i !== j && v.from === r.from),
    )
  )
    throw new Error(
      "Each discard threshold needs a unique positive count and fewer discards than completed rounds.",
    );
}
export function validateSeries(s: Series): void {
  validateDiscardRules(s.discards);
  if (s.pointsStart !== undefined && s.pointsStart !== 0 && s.pointsStart !== 1) throw new Error("Invalid points start");
  if (s.events) {
    if (
      !Array.isArray(s.events) ||
      new Set(s.events.map((e) => e.id)).size !== s.events.length ||
      new Set(s.events.map((e) => e.order)).size !== s.events.length
    )
      throw new Error("Events need unique IDs and order.");
    s.events.forEach((e) => {
      validateDiscardRules(e.discards);
      if (e.scheduledStart && !Number.isFinite(Date.parse(e.scheduledStart))) throw new Error("Invalid race start");
      if (e.countAs !== undefined && (!Number.isInteger(e.countAs) || e.countAs < 1 || e.countAs > 10)) throw new Error("Invalid race count");
      if (
        !e.name.trim() ||
        !Number.isInteger(e.order) ||
        e.order < 1 ||
        !Number.isFinite(e.weight) ||
        e.weight <= 0 ||
        typeof e.completed !== "boolean"
      )
        throw new Error("Invalid event");
    });
    if (s.races.some((r) => !s.events!.some((e) => e.id === r.eventId)))
      throw new Error("Every heat must belong to an event.");
  }

  const uuid = (v: unknown) =>
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const unique = (items: string[]) => new Set(items).size === items.length;
  if (
    !s ||
    !uuid(s.id) ||
    !s.name?.trim() ||
    !Number.isInteger(s.year) ||
    s.year < 1900 ||
    s.year > 2200 ||
    !["draft", "active", "completed"].includes(s.status) ||
    !Array.isArray(s.categories) ||
    !Array.isArray(s.boats) ||
    !Array.isArray(s.races)
  )
    throw new Error("Invalid series backup or details");
  if (
    !s.categories.length ||
    !unique(s.categories.map((c) => c.id)) ||
    s.categories.some((c) => !uuid(c.id) || !c.name?.trim())
  )
    throw new Error("Categories require unique IDs and names");
  if (
    s.boats.some(
      (b) =>
        !uuid(b.id) ||
        !b.name?.trim() ||
        typeof b.sailNumber !== "string" ||
        [b.skipper, b.crewNames].some(
          (value) => value !== undefined && typeof value !== "string",
        ) ||
        (b.publishCrew !== undefined && typeof b.publishCrew !== "boolean") ||
        !s.categories.some((c) => c.id === b.categoryId) ||
        (b.length !== undefined &&
          (!Number.isFinite(b.length) || b.length <= 0)),
    )
  )
    throw new Error("Check boat identity, category and length");
  if (!unique(s.races.map((r) => String(r.order))))
    throw new Error("Each race needs a unique order number");
  for (const r of s.races) {
    if (
      !uuid(r.id) ||
      !r.name?.trim() ||
      (r.date !== "" && (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      !Number.isFinite(Date.parse(r.date)))) ||
      !Number.isInteger(r.order) ||
      r.order < 1 ||
      !Number.isFinite(r.weight) ||
      r.weight <= 0 ||
      r.weight > 100 ||
      !["draft", "published", "locked"].includes(r.status) ||
      !Array.isArray(r.entries) ||
      !Array.isArray(r.results) ||
      r.entries.some((id) => !s.boats.some((b) => b.id === id))
    )
      throw new Error("Check race date, order, weight and registered boats");
  }
  calculateSeriesStandings(s.boats, s.races);
}

export function recordFinish(
  race: ControlRace,
  boats: Boat[],
  boatId: string,
): void {
  if (race.results.some((r) => r.boatId === boatId)) return; // Ignore double taps.
  setFinish(race, boats, boatId, "FINISHED");
}
export function undoLastResult(race: ControlRace, boats: Boat[]): void {
  const last = race.results.reduce(
    (last, r, i) => ({
      index: (r.recordedOrder ?? i + 1) >= last.order ? i : last.index,
      order: Math.max(last.order, r.recordedOrder ?? i + 1),
    }),
    { index: -1, order: -1 },
  );
  if (last.index >= 0) race.results.splice(last.index, 1);
  normalize(race, boats);
}

export function eventsFor(series: Series): RaceEvent[] {
  return (
    series.events ??
    series.races.map((r) => ({
      id: r.id,
      name: r.name,
      order: r.order,
      weight: r.weight,
      completed: r.entries.length > 0 && r.results.length === r.entries.length,
      discards: [],
    }))
  );
}
export function materializeEvents(s: Series) {
  if (s.events) return;
  s.events = eventsFor(s);
  s.races.forEach((r) => {
    r.eventId = r.id;
    r.weight = 1;
  });
}
/** Legacy races inherit the union of their heat registrations without losing results. */
export function eventEntries(series: Series, eventId: string): string[] {
  const event = eventsFor(series).find((e) => e.id === eventId);
  if (!event) throw new Error("Race not found");
  if (event.entries) return [...event.entries];
  const heats = series.races.filter((r) => (r.eventId ?? r.id) === eventId);
  return heats.length ? [...new Set(heats.flatMap((r) => [...r.entries, ...r.results.map((v) => v.boatId)]))] : series.boats.map((b) => b.id);
}
export function setEventEntries(series: Series, eventId: string, entries: string[]) {
  const unique = [...new Set(entries)];
  if (unique.some((id) => !series.boats.some((b) => b.id === id))) throw new Error("Boat is not in the series fleet");
  const heats = series.races.filter((r) => (r.eventId ?? r.id) === eventId);
  if (heats.some((r) => r.results.some((v) => !unique.includes(v.boatId)))) throw new Error("Clear the boat's results before removing it from the race");
  materializeEvents(series);
  const event = series.events!.find((e) => e.id === eventId);
  if (!event) throw new Error("Race not found");
  event.entries = unique;
  heats.forEach((r) => { r.entries = [...unique]; });
}
export function discardCount(rules: DiscardRule[] = [], completed: number) {
  return (
    [...rules].sort((a, b) => b.from - a.from).find((r) => r.from <= completed)
      ?.discard ?? 0
  );
}
export function eventStandings(
  series: Series,
  event: RaceEvent,
  categoryId = "",
) {
  const boats = categoryId || series.pointsStart === 0
    ? series.boats
    : series.boats.map((b) => ({ ...b, categoryId: "overall" }));
  const races = series.races
    .filter((r) => (r.eventId ?? r.id) === event.id)
    .map(r => ({ ...r, entries: [...r.entries], results: r.results.map(result => ({ ...result })) }));
  if (!series.events)
    races.forEach((r) => {
      r.weight = 1;
    });
  if (!categoryId && series.pointsStart !== 0) races.forEach((r) => normalize(r, boats));
  const complete = races.filter(
    (r) => r.entries.length > 0 && r.results.length === r.entries.length,
  ).length;
  return calculateSeriesStandings(boats, races, {
    ...defaultPolicy,
    discardCount: discardCount(event.discards, complete),
  }).filter((b) => !categoryId || b.categoryId === categoryId);
}
export function seriesRounds(series: Series, categoryId = "") {
  return eventsFor(series).sort((a, b) => a.order - b.order).flatMap((e) => {
    const aggregate = series.races.find(r => r.eventId === e.id && r.kind === "aggregate");
    const rows = eventStandings(series, e, categoryId);
    const results = aggregate ? aggregate.results.filter(r => !categoryId || series.boats.find(b => b.id === r.boatId)?.categoryId === categoryId) : rows.filter(b => b.rank > 0).map(b => ({
      boatId: b.id, status: "SCORED" as const, points: b.rank - (series.pointsStart === 0 ? 1 : 0),
    }));
    // Series entrants absent from a completed race receive the category fleet penalty.
    if (series.pointsStart === 0 && e.completed && !aggregate) {
      for (const boat of series.boats.filter(b => !categoryId || b.categoryId === categoryId)) {
        if (!results.some(r => r.boatId === boat.id)) results.push({boatId: boat.id, status: "SCORED", points: rows.filter(r => r.categoryId === boat.categoryId && r.scores.length).length});
      }
    }
    return Array.from({length: e.countAs ?? 1}, (_, i) => ({
      id: i ? `${e.id}:${i + 1}` : e.id,
      eventId: e.id,
      name: (e.countAs ?? 1) > 1 ? `${e.name} (${i + 1}/${e.countAs})` : e.name,
      order: e.order * 100 + i, weight: e.weight,
      entries: results.map(r => r.boatId), results,
    }));
  });
}
export function standingsForView(series: Series, categoryId = "") {
  const boats = categoryId
    ? series.boats.filter((b) => b.categoryId === categoryId)
    : series.boats.map((b) => ({ ...b, categoryId: "overall" }));
  return calculateSeriesStandings(boats, seriesRounds(series, categoryId), {
    ...defaultPolicy,
    allowTiedPositions: true,
    discardCount: discardCount(
      series.discards,
      eventsFor(series).filter(
        (e) =>
          e.completed &&
          series.races.some((r) => (r.eventId ?? r.id) === e.id) &&
          series.races
            .filter((r) => (r.eventId ?? r.id) === e.id)
            .every(
              (r) =>
                r.entries.length > 0 && r.results.length === r.entries.length,
            ),
      ).reduce((n, e) => n + (e.countAs ?? 1), 0),
    ),
  });
}
