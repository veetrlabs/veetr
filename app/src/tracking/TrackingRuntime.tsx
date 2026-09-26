import { syncPendingTrips } from "./tripSharing";
import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { trackingClient } from "./client";
import { trackingStore } from "./database";
import { flushDiagnostics, reportDiagnostic } from "../diagnostics/service";
import {
  resumeTracking,
  stopTracking,
  syncTracking,
  pauseForegroundGPS,
  recoverStalledTracking,
} from "./service";
import { UPLOAD_INTERVAL_MS } from "./model";
export default function TrackingRuntime() {
  useEffect(() => {
    const client = trackingClient;
    const resume = () => {
      void resumeTracking().catch(() => {});
    };
    const active = () => {
      void flushDiagnostics().catch(() => {});
      void syncPendingTrips().catch(() => {});
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
      if (state.isConnected) {
        void syncTracking(true).catch(() => {});
        void flushDiagnostics().catch(() => {});
        void syncPendingTrips().catch(() => {});
      }
    });
    const timer = setInterval(() => {
      void recoverStalledTracking().catch(() => {});
      void flushDiagnostics().catch(() => {});
      void syncPendingTrips().catch(() => {});
      void trackingStore()
        .then(async (store) => {
          const session = await store.get();
          if (session?.phase === "recording") reportDiagnostic('health');
          if (
            session?.phase === "recording" &&
            Date.parse(session.expiresAt) <= Date.now()
          )
            await stopTracking("expired");
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
