import {localDateTime} from "./timezone";
import { eventEntries, eventsFor, id, type ControlRace, type Series } from "./domain";

export function eventIsPublished(series: Series, eventId: string) {
  return series.races.some(r => (r.eventId ?? r.id) === eventId && r.status !== "draft");
}
export function eventDate(series: Series, eventId: string) {
  const start = eventsFor(series).find(e => e.id === eventId)?.scheduledStart;
  if (start) {
    return localDateTime(start).slice(0,10);
  }
  return series.races.find(r => (r.eventId ?? r.id) === eventId && r.date)?.date ?? "";
}
export function newEventHeat(series: Series, eventId: string, name: string): ControlRace {
  return { id: id(), eventId, name, date: eventDate(series, eventId),
    order: Math.max(0, ...series.races.map(r => r.order)) + 1, weight: 1,
    status: eventIsPublished(series, eventId) ? "published" : "draft",
    entries: [...eventEntries(series, eventId)], results: [] };
}
export function setEventPublished(series: Series, eventId: string, published: boolean) {
  const heats = series.races.filter(r => (r.eventId ?? r.id) === eventId);
  if (!published && heats.some(r => r.status === "locked"))
    throw new Error("Unlock the heat results before hiding this race.");
  for (const heat of heats) if (heat.status !== "locked") heat.status = published ? "published" : "draft";
}
