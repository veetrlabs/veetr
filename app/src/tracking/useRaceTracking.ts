import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { trackingStore } from "./database";
import { savedRacePhone, racePhoneRpc, type RacePhone } from "./racePhone";
import type { TrackingSession } from "./model";
export function useRaceTracking() {
  const [state, setState] = useState<{
    session: TrackingSession | null;
    phone: RacePhone | null;
    now: number;
    finished: boolean;
  }>({ session: null, phone: null, now: Date.now(), finished: false });
  useFocusEffect(
    useCallback(() => {
      let alive = true,
        busy = false;
      let checkedLink: string | undefined;
      let finished = false;
      const refresh = async () => {
        if (busy || AppState.currentState === "background") return;
        busy = true;
        try {
          let [session, phone] = await Promise.all([
            (await trackingStore()).get(),
            savedRacePhone(),
          ]);
          const linkId = session?.mode === "race" ? session.raceLinkId : phone?.linkId;
          if (linkId !== checkedLink) {
            checkedLink = linkId;
            finished = !!phone && phone.linkId === linkId && (phone.completed === true || !!phone.endedAt);
          }
          if (linkId) {
            try {
              const status = await racePhoneRpc<RacePhone>(linkId, "race_phone_status");
              phone = status;
              finished = status.completed === true || !!status.endedAt;
            } catch { /* Preserve the last confirmed completion state while offline. */ }
          }
          if (alive) setState({ session, phone, now: Date.now(), finished });
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
