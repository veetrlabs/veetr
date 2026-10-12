import { useEffect, useMemo, useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useNavigation } from "../navigation/NavigationContext";
import { useBLE } from "../context/BLEContext";
import { activePrivateBoat } from "../boats/privateBoats";
import { polarRepository } from "./repository";
import { performanceSmoother } from "../../../packages/shared/src/polar/engine";
import type { Polar } from "../../../packages/shared/src/polar/model";
export function usePerformance(selected?: { boatId: string; polar?: Polar }) {
  const nav = useNavigation(),
    { state } = useBLE();
  const [cached, setCached] = useState<{ boatId: string; polar?: Polar }>({
    boatId: "",
  });
  const [result, setResult] =
    useState<ReturnType<ReturnType<typeof performanceSmoother>>>(null);
  const smooth = useMemo(() => performanceSmoother(), []);
  const sessionBoat =
    nav.session?.phase === "recording" ? nav.session.boatId : undefined;
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const boatId = sessionBoat ?? (await activePrivateBoat())?.id ?? "";
        const library = await polarRepository.read(boatId);
        if (alive)
          setCached({
            boatId,
            polar: library.polars.find((p) => p.id === library.selectedId),
          });
      })().catch(() => {
        if (alive) setCached({ boatId: "" });
      });
      return () => {
        alive = false;
      };
    }, [sessionBoat]),
  );
  const current = selected ?? cached;
  const wind = state.sailingData.recordingInstruments;
  const speed = nav.fix?.sogKnots;
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const valid =
        nav.deviceFresh &&
        state.lastMessageTime != null &&
        now - state.lastMessageTime <= 15000 &&
        wind?.tws != null &&
        wind?.twa != null &&
        speed != null;
      setResult(
        smooth(
          valid ? current.polar : undefined,
          wind?.tws ?? NaN,
          wind?.twa ?? NaN,
          speed ?? NaN,
          now,
          current.boatId,
        ),
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [
    current.polar,
    current.boatId,
    wind?.tws,
    wind?.twa,
    speed,
    nav.deviceFresh,
    state.lastMessageTime,
    smooth,
  ]);
  return { result, polar: current.polar, boatId: current.boatId };
}
