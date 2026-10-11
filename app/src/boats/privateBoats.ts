import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
export type PrivateBoat = { id: string; name: string; className: string; sailNumber: string };
type Fleet = { boats: PrivateBoat[]; activeId?: string };
const key = "veetr-private-boats:v1";
let pending: Promise<unknown> = Promise.resolve();
export async function privateFleet(): Promise<Fleet> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : { boats: [] };
}
function update(change: (fleet: Fleet) => Fleet) {
  const next = pending.then(async () => {
    const fleet = change(await privateFleet());
    await AsyncStorage.setItem(key, JSON.stringify(fleet));
    return fleet;
  });
  pending = next.catch(() => {});
  return next;
}
export function savePrivateBoat(boat: PrivateBoat) {
  const name = boat.name.trim();
  if (!name || name.length > 120) return Promise.reject(new Error("Enter a boat name (up to 120 characters)."));
  return update(fleet => {
    const saved = { ...boat, id: boat.id || Crypto.randomUUID(), name, className: boat.className.trim(), sailNumber: boat.sailNumber.trim() };
    return { boats: [...fleet.boats.filter(b => b.id !== saved.id), saved], activeId: fleet.activeId ?? saved.id };
  });
}
export function selectPrivateBoat(id?: string) {
  return update(fleet => {
    if (id && !fleet.boats.some(b => b.id === id)) throw new Error("No boats found");
    return { ...fleet, activeId: id };
  });
}
export async function activePrivateBoat() {
  const fleet = await privateFleet();
  return fleet.boats.find(b => b.id === fleet.activeId);
}
export function deletePrivateBoat(id: string) {
  return update(fleet => ({
    boats: fleet.boats.filter(boat => boat.id !== id),
    activeId: fleet.activeId === id ? undefined : fleet.activeId,
  }));
}
