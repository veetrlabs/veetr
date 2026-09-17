import { eventsFor, type Series } from './domain';
import type { PublicSeriesSummary } from './api';

export function mergeSeriesDirectory(published: PublicSeriesSummary[], accessible: Series[]): PublicSeriesSummary[] {
  const merged = new Map(published.map(s => [s.id, s]));
  for (const s of accessible) merged.set(s.id, {
    id: s.id, name: s.name, year: s.year, description: s.description,
    status: s.status, raceCount: eventsFor(s).length, boatCount: s.boats.length,
  });
  return [...merged.values()];
}
