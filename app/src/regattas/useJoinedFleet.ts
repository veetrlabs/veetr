import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { racePhoneRpc } from "../tracking/racePhone";
import type { TrackingPosition } from "./positions";
import {
  TrackCache,
  parseTracks,
  type TrackPoint,
} from "../../../veetr.org/src/features/racing/trackCache";
export function useJoinedFleet(linkId?: string) {
  const [state, setState] = useState<{
    positions: TrackingPosition[];
    error: string;
    loading: boolean;
  }>({ positions: [], error: "", loading: false });
  useFocusEffect(
    useCallback(() => {
      let alive = true,
        busy = false;
      let cache = new TrackCache();
      setState({ positions: [], error: "", loading: !!linkId });
      async function refresh() {
        if (!linkId || busy || AppState.currentState === "background") return;
        busy = true;
        try {
          const meta = parseTracks(
            await racePhoneRpc(linkId, "race_phone_tracks"),
          );
          if (!alive) return;
          cache.sync(meta);
          for (const chunk of meta.chunks) {
            if (cache.has(chunk.start, chunk.version)) continue;
            const previous = cache.previous(chunk.start);
            let points: TrackPoint[] = [],
              offset = 0;
            while (alive) {
              const page = parseTracks(
                await racePhoneRpc(linkId, "race_phone_tracks", {
                  p_from: new Date(chunk.start).toISOString(),
                  p_offset: offset,
                  ...(previous
                    ? {
                        p_known_count: previous.points.length,
                        p_known_version: previous.version,
                      }
                    : {}),
                }),
              );
              if (!alive) return;
              if (
                page.chunks.find((c) => c.start === chunk.start)?.version !==
                chunk.version
              )
                throw new Error("Race tracks changed while loading");
              if (!offset && page.append && previous)
                points = [...previous.points];
              points.push(...page.points);
              offset += page.points.length;
              if (!page.more) break;
            }
            cache.put(chunk.start, chunk.version, points);
          }
          const positions = meta.end === null ? [] : cache.frame(meta.end);
          if (alive) setState({ positions, error: "", loading: false });
        } catch {
          cache = new TrackCache();
          if (alive)
            setState({
              positions: [],
              error: "Race positions are unavailable. Reconnecting…",
              loading: false,
            });
        } finally {
          busy = false;
        }
      }
      void refresh();
      const timer = setInterval(() => void refresh(), 5000);
      const subscription = AppState.addEventListener("change", (s) => {
        if (s === "active") void refresh();
      });
      return () => {
        alive = false;
        clearInterval(timer);
        subscription.remove();
      };
    }, [linkId]),
  );
  return state;
}
