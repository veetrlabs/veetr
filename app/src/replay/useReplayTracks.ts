import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { trackingRpc } from "../tracking/client";
import {
  TrackCache,
  parseTracks,
  type TrackMeta,
  type TrackPoint,
} from "../../../veetr.org/src/features/racing/trackCache";
import { replayRequests } from "../../../veetr.org/src/features/racing/replayRequests";

export function useReplayTracks(
  seriesId: string,
  eventId: string,
  heatId: string | undefined,
  at: number,
  enabled: boolean,
) {
  const [meta, setMeta] = useState<TrackMeta | null>(null);
  const [positions, setPositions] = useState<ReturnType<TrackCache["frame"]>>(
    [],
  );
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const cursor = useRef(at);
  cursor.current = at;
  const request = useRef<ReturnType<typeof replayRequests> | null>(null);
  useEffect(() => {
    setMeta(null);
    setPositions([]);
    setError("");
    setLoading(enabled);
    if (!enabled) return;
    let alive = true,
      refreshing = false;
    let current: TrackMeta | null = null;
    let revision = 0;
    const cache = new TrackCache();
    const fetchTracks = async (extra = {}) =>
      parseTracks(
        await trackingRpc("public_replay_tracks", {
          p_series: seriesId,
          p_event: eventId,
          ...(heatId ? { p_heat: heatId } : {}),
          ...extra,
        }),
      );
    const queue = replayRequests(async (requested) => {
      if (!current || current.end === null) {
        if (alive) setLoading(false);
        return;
      }
      const target = requested || current.start!;
      const loadedRevision = revision;
      if (alive) setLoading(true);
      try {
        for (const chunk of cache.needed(current, target)) {
          if (cache.has(chunk.start, chunk.version)) continue;
          const points: TrackPoint[] = [];
          let offset = 0;
          while (alive) {
            const page = await fetchTracks({
              p_from: new Date(chunk.start).toISOString(),
              p_offset: offset,
            });
            if (!alive || loadedRevision !== revision) return;
            if (
              page.chunks.find((c) => c.start === chunk.start)?.version !==
              chunk.version
            ) {
              current = page;
              cache.sync(page);
              setMeta(page);
              queue.request(cursor.current);
              return;
            }
            points.push(...page.points);
            offset += page.points.length;
            if (!page.more) break;
            if (!page.points.length) throw new Error("Invalid replay page");
          }
          cache.put(chunk.start, chunk.version, points);
        }
        if (alive) {
          setPositions(cache.frame(target));
          setError("");
        }
      } catch {
        if (alive) {
          setPositions([]);
          setError(
            "Competitors could not be loaded. Your local track is still available.",
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    });
    request.current = queue;
    const refresh = async () => {
      if (refreshing || !alive || AppState.currentState !== "active") return;
      refreshing = true;
      try {
        const next = await fetchTracks();
        if (!alive) return;
        revision++;
        current = next;
        cache.sync(next);
        setMeta(next);
        queue.request(cursor.current);
      } catch {
        if (alive) {
          revision++;
          current = null;
          setMeta(null);
          setPositions([]);
          setError("Replay is unavailable. Check your connection and retry.");
          setLoading(false);
        }
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    const listener = AppState.addEventListener("change", () => void refresh());
    return () => {
      alive = false;
      clearInterval(timer);
      listener.remove();
      queue.dispose();
      request.current = null;
    };
  }, [seriesId, eventId, heatId, enabled, retry]);
  useEffect(() => {
    request.current?.request(at);
  }, [at]);
  return {
    meta,
    positions,
    loading,
    error,
    retry: () => setRetry((n) => n + 1),
  };
}
