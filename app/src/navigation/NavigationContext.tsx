import { usePhoneMotion } from './usePhoneMotion';
import { reportDiagnostic } from '../diagnostics/service';
import { phoneMotion } from './phoneMotion';
import { createSpeedFilter } from './speedFilter';
import { usePhoneHeading } from './usePhoneHeading';
import { usePhoneStartLine } from './usePhoneStartLine';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { useBLE } from "../context/BLEContext";
import {
  normalizeFix,
  type TrackingPoint,
  type TrackingSession,
} from "../tracking/model";
import { trackingStore } from "../tracking/database";
import { navigationFix } from "./model";
const Context = createContext<ReturnType<typeof useNavigationState> | null>(
  null,
);
function useNavigationState() {
  const { state } = useBLE();
  const phoneStartLine = usePhoneStartLine();
  const phoneHeading = usePhoneHeading();
  usePhoneMotion();
  const [phone, setPhone] = useState<TrackingPoint | null>(null);
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [trail, setTrail] = useState<TrackingPoint[]>([]);
  const [now, setNow] = useState(Date.now());
  const [permission, setPermission] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      watcher: Location.LocationSubscription | null = null,
      generation = 0;
    let trailKey = "";
    let lastCallbackAt = Date.now();
    let starting = false;
    let filterSpeed = createSpeedFilter();
    async function update() {
      starting = true;
      lastCallbackAt = Date.now();
      const version = ++generation;
      watcher?.remove();
      watcher = null;
      filterSpeed = createSpeedFilter();
      setPhone(null);
      if (AppState.currentState !== "active") { starting = false; return; }
      try {
        const granted =
          (await Location.getForegroundPermissionsAsync()).status === "granted";
        if (!alive || version !== generation) return;
        setPermission(granted);
        if (!granted) {
          setPhone(null);
          return;
        }
        const next = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 0,
          },
          (location) => {
            if (!alive || version !== generation) return;
            lastCallbackAt = Date.now();
            const fix = normalizeFix(location);
            if (fix) {
              setPhone(filterSpeed(fix, phoneMotion.state(location.timestamp)));
              setError("");
            }
          },
          (reason) => {
            if (!alive || version !== generation) return;
            reportDiagnostic('gps_error', reason);
            setError(reason);
            watcher?.remove();
            watcher = null;
          },
        );
        if (!alive || version !== generation) next.remove();
        else watcher = next;
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "GPS unavailable");
      } finally {
        if (version === generation) starting = false;
      }
    }
    void update();
    const sub = AppState.addEventListener("change", () => void update());
    const timer = setInterval(() => {
      setNow(Date.now());
      void trackingStore()
        .then(async (s) => {
          const value = await s.get();
          const key = `${value?.id}/${value?.lastRecordedAt}/${value?.phase}`;
          if (key !== trailKey) {
            const points = value ? await s.points(value.id) : [];
            if (alive) {
              setTrail(points.length ? points : (value?.recentPoints ?? []));
              trailKey = key;
            }
          }
          return value;
        })
        .then((value) => {
          if (!alive) return;
          setSession(value);
          const last = value?.recentPoints?.at(-1);
          if (last)
            setPhone((previous) =>
              !previous || last.recordedAt > previous.recordedAt
                ? filterSpeed(last, phoneMotion.state(Date.parse(last.recordedAt)))
                : previous,
            );
        })
        .catch(() => {});
    }, 1000);
    // A permission request can complete without an AppState change.
    const permissions = setInterval(() => {
      if (AppState.currentState === "active" && !starting && (!watcher || Date.now() - lastCallbackAt > 45000)) void update();
    }, 3000);
    return () => {
      alive = false;
      generation++;
      watcher?.remove();
      sub.remove();
      clearInterval(timer);
      clearInterval(permissions);
    };
  }, []);
  async function enableGPS() {
    try {
      setError("");
      const result = await Location.requestForegroundPermissionsAsync();
      setPermission(result.status === "granted");
      if (result.status !== "granted")
        setError("Allow location in Settings to show phone GPS.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "GPS unavailable");
    }
  }
  return {
    ...navigationFix(phone, state, session?.phase === "recording", now),
    phoneHeading,
    phonePoint: phone,
    phoneStartLine,
    session,
    trail,
    permission,
    error,
    enableGPS,
  };
}
export function NavigationProvider({ children }: { children: ReactNode }) {
  return (
    <Context.Provider value={useNavigationState()}>{children}</Context.Provider>
  );
}
export function useNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("NavigationProvider missing");
  return value;
}
