import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackingClient, trackingRpc } from "../../tracking/client";
import { privateFleet, savePrivateBoat, linkRaceBoat } from "../privateBoats";
import {
  publishBoat,
  refreshOwnedBoats,
  publicBoatProfile,
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
  expect(rpc).toHaveBeenCalledWith("my_owned_boats");
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
