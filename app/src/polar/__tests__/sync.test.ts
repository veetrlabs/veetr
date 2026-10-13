import AsyncStorage from "@react-native-async-storage/async-storage";
import { syncPolars, syncPendingPolars, restorePolars } from "../sync";
import { polarRepository } from "../repository";
import { privateFleet, linkRaceBoat, savePrivateBoat } from "../../boats/privateBoats";
let mockUser = "first",
  mockOffline = false;
const mockRows: any[] = [];
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-crypto", () => ({ randomUUID: () => "boat-generated" }));
jest.mock("../../tracking/client", () => ({
  trackingClient: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: mockUser } } },
        error: null,
      }),
    },
    from: () => ({
      upsert: async (row: any) => {
        if (mockOffline) return { error: { message: "offline" } };
        if (
          !mockRows.some(
            (r) => r.user_id === row.user_id && r.polar_id === row.polar_id,
          )
        )
          mockRows.push(row);
        return { error: null };
      },
      select: () => {
        const filters: Record<string, string> = {};
        const query = {
          eq: (key: string, value: string) => {
            filters[key] = value;
            return query;
          },
          limit: async () => ({
            data: mockRows.filter((row) =>
              Object.entries(filters).every(
                ([key, value]) => row[key] === value,
              ),
            ),
            error: mockOffline ? { message: "offline" } : null,
          }),
        };
        return query;
      },
    }),
  },
}));
const polar = {
  id: "p",
  name: "Test",
  version: "1",
  source: "upload" as const,
  createdAt: "2026-10-12T00:00:00Z",
  points: [{ tws: 8, twa: 60, speed: 5 }],
};
beforeEach(async () => {
  await AsyncStorage.clear();
  mockRows.length = 0;
  mockUser = "first";
  mockOffline = false;
});
test("an opted-in offline upload retries only under the same account and is idempotent", async () => {
  await polarRepository.add("boat", polar);
  mockOffline = true;
  await expect(syncPolars("boat")).rejects.toThrow("offline");
  expect((await polarRepository.read("boat")).polars).toHaveLength(1);
  mockUser = "other";
  mockOffline = false;
  await syncPendingPolars();
  expect(mockRows).toHaveLength(0);
  mockUser = "first";
  await syncPendingPolars();
  expect(mockRows).toHaveLength(1);
  await syncPolars("boat");
  expect(mockRows).toHaveLength(1);
});
test("restores the boat identity and cached polar without overwriting a local boat", async () => {
  mockRows.push({
    user_id: "first",
    boat_id: "boat",
    boat_document: { name: "Cloud name" },
    document: polar,
  });
  await restorePolars();
  expect((await privateFleet()).boats[0].id).toBe("boat");
  expect((await polarRepository.read("boat")).selectedId).toBe("p");
  await savePrivateBoat({
    id: "boat",
    name: "Local name",
    className: "Micro",
    sailNumber: "1",
  });
  await restorePolars();
  expect((await privateFleet()).boats[0].name).toBe("Local name");
});

test("local race linking does not upload anything or expose the link through account polar backup", async () => {
  await savePrivateBoat({id:"local",name:"Private boat",className:"",sailNumber:""});
  await polarRepository.add("local",polar);
  await linkRaceBoat({boatId:"race-boat",boatName:"Race boat"},"local");
  expect(mockRows).toHaveLength(0);
  await syncPendingPolars();
  expect(mockRows).toHaveLength(0);
  await syncPolars("local");
  expect(mockRows).toHaveLength(1);
  expect(mockRows[0].boat_id).toBe("local");
  expect(JSON.stringify(mockRows[0])).not.toContain("race-boat");
});

test("account backup restores boat weight", async () => {
 mockRows.push({user_id:"first",boat_id:"weight",boat_document:{name:"Boat",weightKg:3456},document:polar});
 await restorePolars();
 expect((await privateFleet()).boats.find(b=>b.id==="weight")?.weightKg).toBe(3456);
});
