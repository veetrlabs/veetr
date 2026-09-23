import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { trackingStore } from "./database";
import { savedRacePhone, type RacePhone } from "./racePhone";
import type { TrackingSession } from "./model";
export function useRaceTracking() {
  const [state, setState] = useState<{
    session: TrackingSession | null;
    phone: RacePhone | null;
    now: number;
  }>({ session: null, phone: null, now: Date.now() });
  useFocusEffect(
    useCallback(() => {
      let alive = true,
        busy = false;
      const refresh = async () => {
        if (busy || AppState.currentState === "background") return;
        busy = true;
        try {
          const [session, phone] = await Promise.all([
            (await trackingStore()).get(),
            savedRacePhone(),
          ]);
          if (alive) setState({ session, phone, now: Date.now() });
        } finally {
          busy = false;
        }
      };
      const update = () =>
        void refresh().catch(() => {
          if (alive) setState((s) => ({ ...s, now: Date.now() }));
        });
      update();
      const timer = setInterval(update, 3000);
      const subscription = AppState.addEventListener("change", (s) => {
        if (s === "active") update();
      });
      return () => {
        alive = false;
        clearInterval(timer);
        subscription.remove();
      };
    }, []),
  );
  return state;
}
