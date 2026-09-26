import { setTripSharing, syncSharedTrip, selectTripBoat } from "../tripSharing";
import { trackingClient, trackingRpc } from "../client";
import { trackingStore } from "../database";
import type { Trip } from "../trip";
jest.mock("expo-crypto", () => ({ randomUUID: () => "remote-trip" }));
jest.mock("../client", () => ({
  trackingClient: { auth: { getSession: jest.fn() } },
  trackingRpc: jest.fn(),
}));
jest.mock("../database", () => ({ trackingStore: jest.fn() }));
let trip: Trip, visibility: string, token: string, actions: string[];
beforeEach(() => {
  trip = {
    session: {
      id: "local",
      mode: "local",
      userId: "owner",
      boatId: "boat",
      boatName: "Luna",
      seriesId: "",
      seriesName: "",
      phase: "recording",
      startedAt: "2026-09-24T10:00:00Z",
      expiresAt: "2026-09-24T22:00:00Z",
    },
    points: [
      {
        recordedAt: "2026-09-24T10:00:00Z",
        latitude: 50,
        longitude: 14,
        accuracyM: 2,
        sogMps: 0,
        cogDeg: null,
        source: "phone",
      },
    ],
  };
  visibility = "private";
  token = "token";
  actions = [];
  (trackingClient!.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: "owner" } } },
  });
  (trackingStore as jest.Mock).mockResolvedValue({
    localRecordings: async () => [trip],
    trip: async () => trip,
    updateTrip: async (_id: string, patch: object) => {
      Object.assign(trip.session, patch);
    },
  });
  (trackingRpc as jest.Mock).mockImplementation(async (name, args) => {
    if (name === "my_trip_boats") return [{ id: "boat", name: "Luna" }];
    actions.push(args.action);
    if (args.action === "ingest") return args.payload.points.length;
    if (args.action === "publish") {
      visibility = args.payload.visibility;
      if (visibility === "private") token = "new-token";
    }
    return { id: "remote-trip", visibility, token };
  });
});
test("uploads privately before publishing and stops without uploading another sample", async () => {
  await setTripSharing("local", "unlisted", "Family sail");
  expect(actions).toEqual(["create", "ingest", "publish"]);
  expect(trip.session.sharing).toMatchObject({
    visibility: "unlisted",
    uploaded: 1,
    token: "token",
  });
  trip.points.push({ ...trip.points[0], recordedAt: "2026-09-24T10:00:05Z" });
  actions = [];
  await setTripSharing("local", "private", "Family sail");
  expect(actions).toEqual(["create", "publish"]);
  expect(trip.session.sharing).toMatchObject({
    visibility: "private",
    token: "new-token",
    uploaded: 1,
  });
});
test("failed revocation remains pending across retries instead of claiming the link is private", async () => {
  await setTripSharing("local", "unlisted", "Sail");
  const impl = (trackingRpc as jest.Mock).getMockImplementation();
  (trackingRpc as jest.Mock).mockRejectedValue(new Error("Offline"));
  await expect(setTripSharing("local", "private", "Sail")).rejects.toThrow(
    "Offline",
  );
  expect(trip.session.sharing).toMatchObject({
    visibility: "unlisted",
    pendingVisibility: "private",
  });
  (trackingRpc as jest.Mock).mockImplementation(impl!);
  actions = [];
  await syncSharedTrip("local");
  expect(actions).toEqual(["create", "publish"]);
  expect(trip.session.sharing?.visibility).toBe("private");
});
test.each(["public", "unlisted"] as const)("ending a %s recording keeps its link and uploads the final points first", async (visibility) => {
  await setTripSharing("local", visibility, "Sail");
  trip.points.push({ ...trip.points[0], recordedAt: "2026-09-24T10:00:05Z" });
  trip.session.phase = "stopping";
  trip.session.stoppedAt = "2026-09-24T10:00:10Z";
  actions = [];
  await syncSharedTrip("local");
  expect(actions).toEqual(["create", "ingest", "finish"]);
  expect(trip.session.sharing).toMatchObject({
    visibility,
    token: "token",
    uploaded: 2,
    finished: true,
  });
  await setTripSharing("local", "unlisted", "Finished sail");
  expect(trip.session.sharing?.visibility).toBe("unlisted");
});
test("a finished trip waits for all upload batches before finalizing", async () => {
  await setTripSharing("local", "unlisted", "Sail");
  trip.points = Array.from({ length: 5002 }, () => ({ ...trip.points[0] }));
  trip.session.phase = "stopping";
  actions = [];
  await syncSharedTrip("local");
  expect(actions.filter(action => action === "ingest")).toHaveLength(10);
  expect(actions).not.toContain("finish");
  expect(trip.session.sharing?.finished).not.toBe(true);
  actions = [];
  await syncSharedTrip("local");
  expect(actions).toEqual(["create", "ingest", "finish"]);
  expect(trip.session.sharing).toMatchObject({ visibility: "unlisted", finished: true, uploaded: 5002 });
});
test("switching accounts cannot publish or change another recorder’s trip", async () => {
  (trackingClient!.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: "other" } } },
  });
  await expect(setTripSharing("local", "public", "Sail")).rejects.toThrow(
    "trip recorder",
  );
  await expect(
    selectTripBoat("local", { id: "boat", name: "Luna", color: "#008c80" }),
  ).rejects.toThrow("trip recorder");
  expect(actions).toEqual([]);
});

test("sharing selected at trip start waits for GPS before publishing", async () => {
  const first = trip.points[0];
  trip.points = [];
  await setTripSharing("local", "unlisted", "Family sail");
  expect(actions).toEqual(["create"]);
  expect(trip.session.sharing).toMatchObject({ visibility: "private", pendingVisibility: "unlisted" });
  trip.points = [first];
  actions = [];
  await syncSharedTrip("local");
  expect(actions).toEqual(["create", "ingest", "publish"]);
  expect(trip.session.sharing?.pendingVisibility).toBeUndefined();
});
