jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => "device-secret"),
  setItem: jest.fn(),
}));
import { AppState } from "react-native";
jest.mock("react-native", () => ({ AppState: { currentState: "active" } }));
import type { TrackingPoint, TrackingSession } from "../model";
jest.mock("expo-location", () => ({
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => true),
  stopLocationUpdatesAsync: jest.fn(async () => {}),
  startLocationUpdatesAsync: jest.fn(async () => {}),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
  Accuracy: { High: 4 },
  ActivityType: { OtherNavigation: 4 },
}));
jest.mock("expo-task-manager", () => ({
  isTaskDefined: () => false,
  defineTask: jest.fn(),
  isAvailableAsync: async () => true,
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => "new-session" }));
jest.mock("../client", () => ({
  trackingClient: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: "alice" } } },
      })),
    },
  },
  trackingRpc: jest.fn(),
}));
jest.mock("../database", () => ({ trackingStore: jest.fn() }));
import * as Location from "expo-location";
import { trackingClient, trackingRpc } from "../client";
import { trackingStore } from "../database";
import {
  syncTracking,
  stopTracking,
  recordLocations,
  resumeTracking,
  pauseForegroundGPS,
  startLocalTracking,
  discardStoppedTracking,
} from "../service";
let session: TrackingSession | null,
  points: (TrackingPoint & { seq: number })[];
const base = (): TrackingSession => ({
  id: "session",
  userId: "alice",
  phase: "recording",
  seriesId: "series",
  seriesName: "Series",
  boatId: "boat",
  boatName: "Boat",
  startedAt: new Date(Date.now() - 10000).toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
});
const point = (seq: number): TrackingPoint & { seq: number } => ({
  seq,
  recordedAt: new Date().toISOString(),
  latitude: 49,
  longitude: 14,
  accuracyM: 5,
  sogMps: 2,
  cogDeg: 90,
  source: "phone",
});
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
beforeEach(() => {
  jest.clearAllMocks();
  session = base();
  points = [point(1)];
  (trackingClient!.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: "alice" } } },
  });
  (trackingRpc as jest.Mock).mockImplementation(async (name, args) =>
    name === "ingest_tracking_points" ? args.p_points.length : undefined,
  );
  (trackingStore as jest.Mock).mockResolvedValue({
    create: async (value: TrackingSession) => {
      if (session) throw new Error("Existing session");
      session = value;
    },
    get: async () => (session ? { ...session } : null),
    patch: async (id: string, patch: Partial<TrackingSession>) => {
      if (session?.id === id) session = { ...session, ...patch };
    },
    batch: async () => points.map((p) => ({ ...p })),
    count: async () => points.length,
    acknowledge: async (_id: string, seqs: number[]) => {
      points = points.filter((p) => !seqs.includes(p.seq));
    },
    append: async (_id: string, rows: TrackingPoint[]) => {
      if (session?.phase === "recording")
        points.push(
          ...rows.map((p, i) => ({ ...p, seq: points.length + i + 1 })),
        );
    },
    clear: async () => {
      session = null;
      points = [];
    },
  });
});
test("a failed upload retains points for a duplicate-safe retry", async () => {
  (trackingRpc as jest.Mock).mockRejectedValueOnce(new Error("Offline"));
  await expect(syncTracking(true)).rejects.toThrow("Offline");
  expect(points).toHaveLength(1);
  expect(session?.error).toBe("Offline");
  await syncTracking(true);
  expect(points).toHaveLength(0);
  expect(session?.lastUploadAt).toBeTruthy();
});
test("switching accounts cannot upload the prior account’s queue", async () => {
  (trackingClient!.auth.getSession as jest.Mock).mockResolvedValueOnce({
    data: { session: { user: { id: "bob" } } },
  });
  await expect(syncTracking(true)).rejects.toThrow("account that started");
  expect(trackingRpc).not.toHaveBeenCalled();
  expect(points).toHaveLength(1);
});
test("stop persists immediately during an in-flight upload and late GPS cannot add points", async () => {
  let acknowledge!: () => void;
  (trackingRpc as jest.Mock).mockImplementationOnce(
    () =>
      new Promise<number>((resolve) => {
        acknowledge = () => resolve(1);
      }),
  );
  const upload = syncTracking(true);
  await tick();
  expect(acknowledge).toBeDefined();
  points.push(point(2));
  const stop = stopTracking();
  await tick();
  expect((session as TrackingSession | null)?.phase).toBe("stopping");
  await recordLocations([
    {
      timestamp: Date.now(),
      coords: {
        latitude: 49,
        longitude: 14,
        accuracy: 5,
        speed: 2,
        heading: 90,
      },
    },
  ]);
  expect(points).toHaveLength(2);
  acknowledge();
  await upload;
  await stop;
  expect((trackingRpc as jest.Mock).mock.calls.map((c) => c[0])).toEqual([
    "ingest_tracking_points",
    "stop_tracking_session",
    "ingest_tracking_points",
  ]);
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
  expect(session).toBeNull();
});
test("an unacknowledged start retries the same session identity", async () => {
  session = { ...base(), phase: "starting" };
  points = [];
  (trackingRpc as jest.Mock).mockRejectedValueOnce(new Error("Timeout"));
  await expect(resumeTracking()).rejects.toThrow("Timeout");
  expect((session as TrackingSession | null)?.phase).toBe("starting");
  (trackingRpc as jest.Mock).mockResolvedValueOnce({
    startedAt: base().startedAt,
    expiresAt: base().expiresAt,
  });
  await resumeTracking();
  expect((session as TrackingSession | null)?.phase).toBe("recording");
  const starts = (trackingRpc as jest.Mock).mock.calls.filter(
    (c) => c[0] === "start_tracking_session",
  );
  expect(starts[0][1].p_id).toBe(starts[1][1].p_id);
});
test("expired tracking stops before trying to start GPS again", async () => {
  session = { ...base(), expiresAt: new Date(Date.now() - 1000).toISOString() };
  points = [];
  await resumeTracking();
  expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(session).toBeNull();
});

test("local recording starts without auth and never uploads, even on reconnect or stop", async () => {
  session = null;
  points = [];
  (trackingClient!.auth.getSession as jest.Mock).mockRejectedValue(
    new Error("No network"),
  );
  await startLocalTracking();
  expect((session as TrackingSession | null)?.mode).toBe("local");
  await recordLocations([
    {
      timestamp: Date.now(),
      coords: {
        latitude: 49,
        longitude: 14,
        accuracy: 5,
        speed: 2,
        heading: 90,
      },
    },
  ]);
  await syncTracking(true);
  expect(points).toHaveLength(1);
  await stopTracking();
  await resumeTracking();
  expect((session as TrackingSession | null)?.phase).toBe("stopping");
  expect(points).toHaveLength(1);
  expect(trackingClient!.auth.getSession).not.toHaveBeenCalled();
  expect(trackingRpc).not.toHaveBeenCalled();
  await discardStoppedTracking();
  expect(session).toBeNull();
});
test("an expired local recording stops and keeps its saved points", async () => {
  session = {
    ...base(),
    mode: "local",
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  };
  await resumeTracking();
  expect((session as TrackingSession | null)?.phase).toBe("stopping");
  expect(points).toHaveLength(1);
  expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(trackingRpc).not.toHaveBeenCalled();
});

test("local recording accepts foreground permission when background permission is declined", async () => {
  session = null;
  points = [];
  (
    Location.requestBackgroundPermissionsAsync as jest.Mock
  ).mockResolvedValueOnce({ status: "denied" });
  (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
    status: "denied",
  });
  await startLocalTracking();
  expect((session as TrackingSession | null)?.phase).toBe("recording");
  expect((session as TrackingSession | null)?.backgroundEnabled).toBe(false);
  expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(Location.watchPositionAsync).toHaveBeenCalled();
  expect(trackingRpc).not.toHaveBeenCalled();
  await stopTracking();
});

test("background capture continues when foreground subscriptions are paused", async () => {
  session = { ...base(), mode: "local" };
  points = [];
  await resumeTracking();
  expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    }),
  );
  (AppState as { currentState: string }).currentState = "background";
  try {
    pauseForegroundGPS();
    await recordLocations([
      {
        timestamp: Date.now(),
        coords: {
          latitude: 49,
          longitude: 14,
          accuracy: 5,
          speed: 2,
          heading: 90,
        },
      },
    ]);
    expect(points).toHaveLength(1);
    expect(session?.phase).toBe("recording");
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  } finally {
    (AppState as { currentState: string }).currentState = "active";
  }
});

test("explicit takeover survives an uncertain start and retries with the same session ID", async () => {
  session = {
    ...base(),
    phase: "starting",
    takeOver: true,
    replayEnabled: true,
  };
  points = [];
  (trackingRpc as jest.Mock).mockRejectedValueOnce(new Error("Offline"));
  await expect(resumeTracking()).rejects.toThrow("Offline");
  expect(session?.phase).toBe("starting");
  (trackingRpc as jest.Mock).mockResolvedValueOnce({
    startedAt: base().startedAt,
    expiresAt: base().expiresAt,
  });
  await resumeTracking();
  expect(trackingRpc).toHaveBeenNthCalledWith(1, "take_over_tracking_session", {
    p_id: "session",
    p_series: "series",
    p_boat: "boat",
    p_replay: true,
  });
  expect(trackingRpc).toHaveBeenNthCalledWith(2, "take_over_tracking_session", {
    p_id: "session",
    p_series: "series",
    p_boat: "boat",
    p_replay: true,
  });
  expect(session?.phase).toBe("recording");
});

test("a ready race phone waits privately and begins sharing after referee activation", async () => {
  session = {
    ...base(),
    mode: "race",
    userId: "",
    raceLinkId: "link",
    raceActive: false,
  };
  points = [];
  let active = false;
  (trackingRpc as jest.Mock).mockImplementation(async (name, args) =>
    name === "race_phone_status"
      ? { valid: true, eligible: true, active, ready: true }
      : name === "ingest_race_phone_points"
        ? args.p_points.length
        : undefined,
  );
  await syncTracking(true);
  await recordLocations([
    {
      timestamp: Date.now(),
      coords: {
        latitude: 49,
        longitude: 14,
        accuracy: 5,
        speed: 2,
        heading: 90,
      },
    },
  ]);
  expect(points).toHaveLength(0);
  expect(trackingClient!.auth.getSession).not.toHaveBeenCalled();
  active = true;
  await syncTracking(true);
  await recordLocations([
    {
      timestamp: Date.now(),
      coords: {
        latitude: 49,
        longitude: 14,
        accuracy: 5,
        speed: 2,
        heading: 90,
      },
    },
  ]);
  expect(points).toHaveLength(1);
  await syncTracking(true);
  expect(points).toHaveLength(0);
  active = false;
  await syncTracking(true);
  await recordLocations([
    {
      timestamp: Date.now(),
      coords: {
        latitude: 49,
        longitude: 14,
        accuracy: 5,
        speed: 2,
        heading: 90,
      },
    },
  ]);
  expect(points).toHaveLength(0);
});
test("a stale race-control connection does not keep capturing positions indefinitely", async () => {
  session = {
    ...base(),
    mode: "race",
    raceLinkId: "link",
    raceActive: true,
    raceCheckedAt: new Date(Date.now() - 120000).toISOString(),
  };
  points = [];
  (trackingRpc as jest.Mock).mockRejectedValue(new Error("Offline"));
  await syncTracking(true).catch(() => {});
  await recordLocations([
    {
      timestamp: Date.now(),
      coords: {
        latitude: 49,
        longitude: 14,
        accuracy: 5,
        speed: 2,
        heading: 90,
      },
    },
  ]);
  expect(points).toHaveLength(0);
});
test("revoking a ready phone stops native GPS and completes its session", async () => {
  session = { ...base(), mode: "race", raceLinkId: "link", raceActive: true };
  points = [];
  (trackingRpc as jest.Mock).mockImplementation(async (name) =>
    name === "race_phone_status"
      ? { valid: false, ready: true, eligible: true, active: true }
      : undefined,
  );
  await syncTracking(true);
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
  expect(session).toBeNull();
  expect(trackingRpc).toHaveBeenCalledWith(
    "stop_race_phone",
    expect.objectContaining({ lid: "link" }),
  );
});
