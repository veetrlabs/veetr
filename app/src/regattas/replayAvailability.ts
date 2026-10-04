import { trackingRpc } from '../tracking/client';
import { parseTracks } from '../../../veetr.org/src/features/racing/trackCache';
import type { RaceRegatta } from './model';

// No p_from: request only metadata, not any recorded track points.
export async function raceReplayBounds(race: Pick<RaceRegatta, 'seriesId' | 'eventId'>) {
  const meta = parseTracks(await trackingRpc('public_replay_tracks', {
    p_series: race.seriesId, p_event: race.eventId,
  }));
  return {
    replayStart: meta.start === null ? undefined : new Date(meta.start).toISOString(),
    replayEnd: meta.end === null ? undefined : new Date(meta.end).toISOString(),
  };
}
