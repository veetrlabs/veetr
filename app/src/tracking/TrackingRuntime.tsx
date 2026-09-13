import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { trackingClient } from "./client";
import { trackingStore } from "./database";
import {
  resumeTracking,
  stopTracking,
  syncTracking,
  pauseForegroundGPS,
} from "./service";
import { UPLOAD_INTERVAL_MS } from "./model";
export default function TrackingRuntime() {
  useEffect(() => {
    const client = trackingClient;
    const resume = () => {
      void resumeTracking().catch(() => {});
    };
    const active = () => {
      if (AppState.currentState === "active") {
        client?.auth.startAutoRefresh();
        resume();
      } else {
        client?.auth.stopAutoRefresh();
        pauseForegroundGPS();
      }
    };
    active();
    const sub = AppState.addEventListener("change", active);
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncTracking(true).catch(() => {});
    });
    const timer = setInterval(() => {
      void trackingStore()
        .then(async (store) => {
          const session = await store.get();
          if (
            session?.phase === "recording" &&
            Date.parse(session.expiresAt) <= Date.now()
          )
            await stopTracking();
          else await syncTracking();
        })
        .catch(() => {});
    }, UPLOAD_INTERVAL_MS);
    return () => {
      sub.remove();
      unsubscribe();
      clearInterval(timer);
      client?.auth.stopAutoRefresh();
    };
  }, []);
  return null;
}
