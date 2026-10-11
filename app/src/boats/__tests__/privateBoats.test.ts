import AsyncStorage from "@react-native-async-storage/async-storage";
import { privateFleet, savePrivateBoat, selectPrivateBoat, activePrivateBoat } from "../privateBoats";
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-crypto", () => ({ randomUUID: () => "new-boat" }));
beforeEach(async () => { await AsyncStorage.clear(); });
test("creates a private boat, persists details and remembers the active boat", async () => {
  await savePrivateBoat({ id: "", name: " Luna ", className: " Cruiser ", sailNumber: " 12 " });
  expect(await activePrivateBoat()).toEqual({ id: "new-boat", name: "Luna", className: "Cruiser", sailNumber: "12" });
  await savePrivateBoat({ id: "second", name: "Dawn", className: "", sailNumber: "" });
  await selectPrivateBoat("second");
  expect((await activePrivateBoat())?.name).toBe("Dawn");
  await savePrivateBoat({ id: "second", name: "Dawn II", className: "", sailNumber: "" });
  expect((await privateFleet()).boats).toHaveLength(2);
  expect((await activePrivateBoat())?.name).toBe("Dawn II");
  await selectPrivateBoat();
  expect(await activePrivateBoat()).toBeUndefined();
});
test("invalid changes preserve the fleet and queued edits preserve separate boats", async () => {
  await expect(savePrivateBoat({ id: "", name: " ", className: "", sailNumber: "" })).rejects.toThrow();
  await Promise.all(["a", "b"].map(id => savePrivateBoat({ id, name: id, className: "", sailNumber: "" })));
  await expect(selectPrivateBoat("missing")).rejects.toThrow();
  expect((await privateFleet()).boats.map(b => b.id)).toEqual(["a", "b"]);
});
