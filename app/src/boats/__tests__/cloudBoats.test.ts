import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackingClient, trackingRpc } from "../../tracking/client";
import { privateFleet, savePrivateBoat, linkRaceBoat } from "../privateBoats";
import {
  publishBoat,
  refreshOwnedBoats,
  publicBoatProfile,
  uploadBoat,
} from "../cloudBoats";
import { polarRepository } from "../../polar/repository";
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../tracking/client", () => ({
  trackingClient: { auth: { getSession: jest.fn() } },
  trackingRpc: jest.fn(),
}));
let mockId = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `generated-${++mockId}` }));
const session = trackingClient!.auth.getSession as jest.Mock;
const rpc = trackingRpc as jest.Mock;
const boat = {
  id: "local",
  name: "Mine",
  className: "Cruiser",
  sailNumber: "123",
  weightKg: 5000,
};
const polar = {
  id: "polar",
  name: "Reference",
  source: "manual" as const,
  version: "1",
  createdAt: "2026-10-13T00:00:00Z",
  points: [{ tws: 6, twa: 60, speed: 4 }],
};
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  session.mockResolvedValue({ data: { session: { user: { id: "owner" } } } });
});
test("publishes only selected reference and public dimensions, retrying with one stable identity", async () => {
  await savePrivateBoat({ ...boat, catalogPolar: polar });
  await AsyncStorage.setItem(
    "private-trip",
    JSON.stringify({ boatId: boat.id }),
  );
  rpc
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ id: "cloud" });
  await expect(publishBoat(boat.id)).rejects.toThrow("Offline");
  await publishBoat(boat.id);
  const first = rpc.mock.calls[0][1],
    second = rpc.mock.calls[1][1];
  expect(first.bid).toBe(second.bid);
  expect(first.profile.polar).toEqual(polar);
  expect(first.profile.weightKg).toBe(5000);
  expect(first.profile).not.toHaveProperty("catalogPolar");
  expect(first.profile).not.toHaveProperty("id");
  expect(await AsyncStorage.getItem("private-trip")).toBe(
    JSON.stringify({ boatId: boat.id }),
  );
  expect((await privateFleet()).boats).toHaveLength(1);
  const payload = publicBoatProfile(boat, {
    ...polar,
    learning: { secret: "private" } as any,
    points: [{ ...polar.points[0], confidence: { samples: 10 } as any }],
  });
  expect(JSON.stringify(payload)).not.toMatch(/confidence|learning|secret/);
});
test("owned refresh reuses a tracking link and preserves local edits and trips", async () => {
  await savePrivateBoat({ ...boat, catalogPolar: polar });
  await linkRaceBoat({ boatId: "cloud", boatName: "Race name" }, boat.id);
  rpc.mockResolvedValue([
    {
      id: "cloud",
      name: "Cloud name",
      updatedAt: "today",
      polar: { ...polar, id: "cloud-polar" },
    },
  ]);
  const fleet = await refreshOwnedBoats();
  expect(fleet.boats).toHaveLength(1);
  expect(fleet.boats[0].name).toBe("Mine");
  expect(fleet.boats[0].id).toBe("local");
  expect((await polarRepository.read("local")).selectedId).toBe("polar");
  expect(rpc).toHaveBeenCalledWith("my_account_boats");
  await publishBoat("local", { ...boat, id: "cloud", updatedAt: "previous" });
  expect(rpc).toHaveBeenLastCalledWith(
    "publish_private_boat",
    expect.objectContaining({ bid: "cloud", expected: "previous" }),
  );
});
test("new owned boats import once with their polar; account switches reject a late response", async () => {
  rpc.mockResolvedValue([
    { id: "cloud", name: "Received", updatedAt: "today", polar },
  ]);
  const first = await refreshOwnedBoats();
  await refreshOwnedBoats();
  expect((await privateFleet()).boats).toHaveLength(1);
  expect((await polarRepository.read(first.boats[0].id)).selectedId).toBe(
    "polar",
  );
  session
    .mockResolvedValueOnce({ data: { session: { user: { id: "owner" } } } })
    .mockResolvedValue({ data: { session: { user: { id: "different" } } } });
  rpc.mockResolvedValue([
    { id: "another", name: "Do not import", updatedAt: "today" },
  ]);
  await expect(refreshOwnedBoats()).rejects.toThrow("Sign in");
  expect((await privateFleet()).boats).toHaveLength(1);
});
test("signed out refresh stays local and publishing is rejected", async () => {
  session.mockResolvedValue({ data: { session: null } });
  await savePrivateBoat(boat);
  expect((await refreshOwnedBoats()).boats[0].id).toBe("local");
  await expect(publishBoat("local")).rejects.toThrow("Sign in");
  expect(rpc).not.toHaveBeenCalled();
});

test("whole boat upload defaults to a private account copy and downloads later edits without overwriting local changes", async () => {
  await savePrivateBoat({
    ...boat,
    catalogPolar: polar,
    catalogId: "catalog-id",
  });
  rpc.mockImplementation(async (name, args) =>
    name === "upload_account_boat"
      ? {
          ...args.profile,
          id: args.bid,
          updatedAt: "one",
          privateUpdatedAt: "one",
          publiclyVisible: false,
          uploadPublic: false,
        }
      : [],
  );
  const saved = await uploadBoat(boat.id, false);
  expect(rpc).toHaveBeenLastCalledWith(
    "upload_account_boat",
    expect.objectContaining({
      publish: false,
      profile: expect.objectContaining({
        catalogId: "catalog-id",
        weightKg: 5000,
      }),
    }),
  );
  rpc.mockResolvedValue([
    {
      ...saved,
      name: "Edited on tablet",
      polar: { ...polar, points: [{ tws: 6, twa: 60, speed: 5 }] },
    },
  ]);
  await refreshOwnedBoats();
  expect((await privateFleet()).boats[0].name).toBe("Edited on tablet");
  expect((await polarRepository.read(boat.id)).polars[0].points[0].speed).toBe(
    5,
  );
  await savePrivateBoat({
    ...(await privateFleet()).boats[0],
    name: "Unsaved local edit",
  });
  rpc.mockResolvedValue([{ ...saved, name: "Another tablet edit" }]);
  await refreshOwnedBoats();
  expect((await privateFleet()).boats[0].name).toBe("Unsaved local edit");
});

test("downloading a cleared reference retains measured curves and trip observations", async () => {
  rpc.mockResolvedValue([
    { id: "cloud", name: "Boat", updatedAt: "one", polar },
  ]);
  const fleet = await refreshOwnedBoats();
  const local = fleet.boats[0].id;
  await polarRepository.setPolar(local, {
    ...polar,
    id: "measured",
    source: "learned",
  });
  await polarRepository.saveObservations(local, "trip", [
    {
      id: "sample",
      boatId: local,
      timestamp: 1,
      tws: 6,
      twa: 60,
      speed: 4,
      gpsValid: true,
      windValid: true,
    },
  ]);
  rpc.mockResolvedValue([{ id: "cloud", name: "Boat", updatedAt: "two" }]);
  await refreshOwnedBoats();
  expect((await polarRepository.read(local)).polars.map((p) => p.id)).toEqual([
    "measured",
  ]);
  expect(await polarRepository.observations(local)).toHaveLength(1);
});

test("a failed download restores the reference and leaves the saved local boat intact", async () => {
  rpc.mockResolvedValue([
    { id: "cloud", name: "Before", updatedAt: "one", polar },
  ]);
  const fleet = await refreshOwnedBoats(),
    local = fleet.boats[0].id;
  rpc.mockResolvedValue([
    {
      id: "cloud",
      name: "After",
      updatedAt: "two",
      polar: { ...polar, points: [{ tws: 6, twa: 60, speed: 5 }] },
    },
  ]);
  const original = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
  const spy = jest
    .spyOn(AsyncStorage, "setItem")
    .mockImplementation(async (key, value) => {
      if (key === "veetr-private-boats:v1") throw new Error("Disk full");
      return original(key, value);
    });
  try {
    await expect(refreshOwnedBoats()).rejects.toThrow("Disk full");
  } finally {
    spy.mockImplementation(original);
  }
  expect((await privateFleet()).boats[0].name).toBe("Before");
  expect((await polarRepository.read(local)).polars[0].points[0].speed).toBe(4);
});
