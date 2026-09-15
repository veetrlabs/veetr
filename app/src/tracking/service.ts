import { preferredRecordingPoint } from "./recordingSource";
import { AppState } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Crypto from "expo-crypto";
import { trackingClient, trackingRpc } from "./client";
import { trackingStore } from "./database";
import {
  normalizeFix,
  UPLOAD_INTERVAL_MS,
  type LocationFix,
  type TrackingEntry,
  type TrackingSession,
} from "./model";
export const LOCATION_TASK = "veetr-regatta-location-v1";
let foreground: Location.LocationSubscription | null = null;
let foregroundGeneration = 0;
export function pauseForegroundGPS() {
  foregroundGeneration++;
  foreground?.remove();
  foreground = null;
}
let syncing: Promise<void> | null = null;
let lastAttempt = 0;
let control: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const result = control.then(action);
  control = result.catch(() => {});
  return result;
}
export const startTracking = (entry: TrackingEntry, replayEnabled = false) =>
  serialize(() => startInternal(entry, replayEnabled));
export const resumeTracking = () => serialize(resumeInternal);
export const enableBackgroundTracking = () =>
  serialize(async () => {
    await requestPermissions();
    await resumeInternal();
  });
export async function stopTracking(reason: "user" | "expired" = "user") {
  const store = await trackingStore(),
    session = await store.get();
  if (!session) return;
  await store.patch(session.id, {
    phase: "stopping",
    stopReason: session.stopReason ?? reason,
    stoppedAt: session.stoppedAt ?? new Date().toISOString(),
  });
  await stopGPS();
  return serialize(stopInternal);
}
export const discardStoppedTracking = () => serialize(discardInternal);
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Tracking failed. Try again.";
async function owner(session: TrackingSession) {
  const auth = await trackingClient?.auth.getSession();
  if (auth?.data.session?.user.id !== session.userId)
    throw new Error(
      "Sign in with the account that started this session to finish syncing.",
    );
}
async function stopGPS() {
  pauseForegroundGPS();
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}
async function startGPS(local = false) {
  const background =
    (await Location.getBackgroundPermissionsAsync()).status === "granted";
  const store = await trackingStore();
  const session = await store.get();
  if (session) await store.patch(session.id, { backgroundEnabled: false });
  if (!background) {
    if (!local)
      throw new Error(
        "Enable background location permission to resume live tracking.",
      );
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    if (!foreground && AppState.currentState === "active") {
      const generation = foregroundGeneration;
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (location) => {
          if (
            generation === foregroundGeneration &&
            AppState.currentState === "active"
          )
            void recordLocations([location]).catch(() => {});
        },
      );
      if (
        generation !== foregroundGeneration ||
        AppState.currentState !== "active"
      )
        subscription.remove();
      else foreground = subscription;
    }
    return;
  }
  pauseForegroundGPS();
  // Reapply native options on resume: task registration alone does not prove the manager is running.
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 0,
    deferredUpdatesInterval: 0,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.OtherNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Veetr regatta tracking",
      notificationBody: local
        ? "Recording GPS on this phone. Open Veetr to stop."
        : "Sharing your boat position. Open Veetr to stop.",
      killServiceOnDestroy: true,
    },
  });
  if (!(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)))
    throw new Error(
      "Background GPS did not start. Keep the app open and retry.",
    );
  if (session)
    await store.patch(session.id, {
      backgroundEnabled: true,
      backgroundStartedAt: new Date().toISOString(),
    });
}
async function flush() {
  const store = await trackingStore();
  const session = await store.get();
  if (!session || session.mode === "local" || session.phase === "starting")
    return;
  try {
    await owner(session);
    if (session.phase === "stopping")
      await trackingRpc("stop_tracking_session", {
        p_id: session.id,
        p_stopped_at: session.stoppedAt,
      });
    // Limit each wakeup; later callbacks/foreground retries continue draining an offline backlog.
    for (let i = 0; i < 10; i++) {
      // Give a local stop priority over draining a large offline backlog.
      if (
        session.phase === "recording" &&
        (await store.get())?.phase !== "recording"
      )
        return;
      const batch = await store.batch(session.id);
      if (!batch.length) break;
      const accepted = await trackingRpc<number>("ingest_tracking_points", {
        p_session: session.id,
        p_points: batch,
      });
      if (accepted !== batch.length)
        throw new Error("The server did not acknowledge the complete batch.");
      await store.acknowledge(
        session.id,
        batch.map((p) => p.seq),
      );
      await store.patch(session.id, {
        lastUploadAt: new Date().toISOString(),
        error: undefined,
      });
    }
    const current = await store.get();
    if (
      session.phase === "stopping" &&
      current?.id === session.id &&
      (await store.count()) === 0
    )
      await store.clear(session.id);
    else await store.patch(session.id, { error: undefined });
  } catch (error) {
    await store.patch(session.id, { error: message(error) });
    throw error;
  }
}
export function syncTracking(force = false): Promise<void> {
  if (syncing) return syncing;
  if (!force && Date.now() - lastAttempt < UPLOAD_INTERVAL_MS)
    return Promise.resolve();
  lastAttempt = Date.now();
  syncing = flush().finally(() => {
    syncing = null;
  });
  return syncing;
}
export const startLocalTracking = () =>
  serialize(async () => {
    const store = await trackingStore();
    const previous = await store.get();
    if (
      previous &&
      (previous.mode !== "local" || previous.phase !== "stopping")
    )
      throw new Error("Stop the current recording first.");
    await requestPermissions(true);
    if (previous) await store.archiveLocal();
    const now = Date.now();
    await store.create({
      id: Crypto.randomUUID(),
      mode: "local",
      userId: "",
      boatId: "",
      boatName: "Local GPS recording",
      seriesId: "",
      seriesName: "",
      phase: "recording",
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
    });
    await resumeInternal();
  });
async function requestPermissions(allowForeground = false) {
  if ((await Location.requestForegroundPermissionsAsync()).status !== "granted")
    throw new Error("Precise location permission is required.");
  if (
    (await Location.requestBackgroundPermissionsAsync()).status !== "granted" &&
    !allowForeground
  )
    throw new Error(
      "To record with the screen locked, open Settings → Privacy & Security → Location Services → Veetr and select Always. Keep Precise Location on, then return and start again.",
    );
  if (!(await TaskManager.isAvailableAsync()))
    throw new Error(
      "Install a development or release build to use background tracking.",
    );
}
async function startInternal(entry: TrackingEntry, replayEnabled = false) {
  if (!trackingClient)
    throw new Error("Tracking is not configured in this app build.");
  const {
    data: { session: auth },
  } = await trackingClient.auth.getSession();
  if (!auth) throw new Error("Sign in before starting tracking.");
  await requestPermissions();
  const store = await trackingStore();
  await store.create({
    ...entry,
    replayEnabled,
    id: Crypto.randomUUID(),
    userId: auth.user.id,
    phase: "starting",
    startedAt: new Date().toISOString(),
    expiresAt: "",
  });
  await resumeInternal();
}
async function resumeInternal() {
  const store = await trackingStore();
  let session = await store.get();
  if (!session) return;
  try {
    if (session.mode === "local") {
      if (
        session.phase === "recording" &&
        Date.parse(session.expiresAt) > Date.now()
      ) {
        await startGPS(true);
        await store.patch(session.id, { error: undefined });
      } else if (session.phase === "recording") await stopInternal("expired");
      else await stopGPS();
      return;
    }
    await owner(session);
    if (session.phase === "starting") {
      const reply = await trackingRpc<{ startedAt: string; expiresAt: string }>(
        session.replayEnabled
          ? "start_replay_tracking_session"
          : "start_tracking_session",
        {
          p_id: session.id,
          p_series: session.seriesId,
          p_boat: session.boatId,
        },
      );
      const current = await store.get();
      await store.patch(session.id, {
        ...reply,
        phase: current?.phase === "stopping" ? "stopping" : "recording",
        error: undefined,
      });
      session = (await store.get())!;
    }
    if (session.phase === "recording") {
      if (Date.parse(session.expiresAt) <= Date.now())
        return stopInternal("expired");
      await startGPS();
    } else await stopGPS();
    await syncTracking(true);
  } catch (error) {
    await store.patch(session.id, { error: message(error) });
    throw error;
  }
}
async function stopInternal(reason: "user" | "expired" = "user") {
  const store = await trackingStore(),
    session = await store.get();
  if (!session) return;
  // Persist the stop before any network request or native shutdown. Late callbacks cannot append.
  await store.patch(session.id, {
    phase: "stopping",
    stopReason: session.stopReason ?? reason,
    stoppedAt: session.stoppedAt ?? new Date().toISOString(),
  });
  await stopGPS();
  await syncing?.catch(() => {});
  await syncTracking(true);
}
async function discardInternal() {
  const store = await trackingStore(),
    session = await store.get();
  if (!session || session.phase !== "stopping")
    throw new Error("Stop tracking before discarding saved positions.");
  if (session.mode === "local") {
    await stopGPS();
    await store.clear(session.id);
    return;
  }
  await owner(session);
  await stopGPS();
  await syncing?.catch(() => {});
  // Never forget an active server session on an uncertain network response.
  await trackingRpc("stop_tracking_session", {
    p_id: session.id,
    p_stopped_at: session.stoppedAt,
  });
  await store.clear(session.id);
}
export async function recordLocations(locations: LocationFix[]) {
  const store = await trackingStore(),
    session = await store.get();
  if (!session || session.phase !== "recording") return;
  if (Date.now() >= Date.parse(session.expiresAt))
    return stopTracking("expired");
  try {
    // Capture is fully offline; only uploads require a current authenticated session.
    const points = locations
      .map((f) => preferredRecordingPoint(normalizeFix(f)))
      .filter((p): p is NonNullable<typeof p> => p !== null);
    if (points.length) await store.append(session.id, points);
    else
      await store.patch(session.id, {
        error: "Waiting for an accurate GPS fix (100 m or better).",
      });
    await syncTracking();
  } catch (error) {
    await store.patch(session.id, { error: message(error) });
    throw error;
  }
}
// Defined at module scope so Expo can launch this task without mounting a screen.
if (!TaskManager.isTaskDefined(LOCATION_TASK))
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    LOCATION_TASK,
    async ({ data, error }) => {
      try {
        if (error) throw new Error(error.message);
        if (data?.locations) {
          await recordLocations(data.locations);
          if (AppState.currentState === "background") {
            const store = await trackingStore(),
              session = await store.get();
            if (session?.phase === "recording")
              await store.patch(session.id, {
                lastBackgroundFixAt: new Date().toISOString(),
              });
          }
        }
      } catch (error) {
        const store = await trackingStore(),
          session = await store.get();
        if (session)
          await store.patch(session.id, {
            error: message(error),
            lastTaskError: message(error),
          });
      }
    },
  );

export async function recordDevicePoint(
  point: import("./model").TrackingPoint | null,
) {
  if (!point) return;
  const store = await trackingStore(),
    session = await store.get();
  if (!session || session.phase !== "recording") return;
  if (Date.now() >= Date.parse(session.expiresAt))
    return stopTracking("expired");
  await store.append(session.id, [point]);
  await syncTracking();
}
