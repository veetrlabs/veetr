import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackingClient } from "../tracking/client";
import { privateFleet, savePrivateBoat } from "../boats/privateBoats";
import { polarRepository } from "./repository";
import {
  validatePolar,
  type Polar,
} from "../../../packages/shared/src/polar/model";
const pendingKey = (userId: string) => `veetr:polar-sync:v1:${userId}`;
let tail: Promise<unknown> = Promise.resolve();
function exclusive<T>(action: () => Promise<T>): Promise<T> {
  const next = tail.then(action);
  tail = next.catch(() => {});
  return next;
}
async function signedInUser() {
  if (!trackingClient) throw new Error("Sign in to sync polars.");
  const {
    data: { session },
    error,
  } = await trackingClient.auth.getSession();
  if (error || !session) throw new Error("Sign in to sync polars.");
  return session.user.id;
}
async function transfer(boatId: string, userId: string) {
  if (!trackingClient || (await signedInUser()) !== userId)
    throw new Error("Sign in to sync polars.");
  const local = await polarRepository.read(boatId),
    boat = (await privateFleet()).boats.find((b) => b.id === boatId);
  for (const polar of local.polars) {
    const { error } = await trackingClient.from("polar_library").upsert(
      {
        user_id: userId,
        polar_id: polar.id,
        boat_id: boatId,
        boat_document: boat ?? {
          id: boatId,
          name: "Boat",
          className: "",
          sailNumber: "",
        },
        document: polar,
      },
      { onConflict: "user_id,polar_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  }
  const { data, error } = await trackingClient
    .from("polar_library")
    .select("document")
    .eq("user_id", userId)
    .eq("boat_id", boatId)
    .limit(1000);
  if (error) throw new Error(error.message);
  if ((await signedInUser()) !== userId)
    throw new Error("Sign in to sync polars.");
  for (const row of data ?? []) {
    const polar = validatePolar(row.document as Polar);
    if (
      !(await polarRepository.read(boatId)).polars.some(
        (p) => p.id === polar.id,
      )
    )
      await polarRepository.add(boatId, polar);
  }
  return polarRepository.read(boatId);
}
/** Explicit opt-in; persist a user-scoped retry before any network operation. */
export function syncPolars(boatId: string) {
  return exclusive(async () => {
    const userId = await signedInUser(),
      key = pendingKey(userId),
      pending: string[] = JSON.parse((await AsyncStorage.getItem(key)) ?? "[]");
    await AsyncStorage.setItem(
      key,
      JSON.stringify([...new Set([...pending, boatId])]),
    );
    const result = await transfer(boatId, userId);
    await AsyncStorage.setItem(
      key,
      JSON.stringify(pending.filter((id) => id !== boatId)),
    );
    return result;
  });
}
let pendingSync: Promise<void> | undefined;
export function syncPendingPolars() {
  if (pendingSync) return pendingSync;
  pendingSync = exclusive(async () => {
    const userId = await signedInUser(),
      key = pendingKey(userId);
    let pending: string[] = JSON.parse(
      (await AsyncStorage.getItem(key)) ?? "[]",
    );
    for (const boatId of [...pending]) {
      await transfer(boatId, userId);
      pending = pending.filter((id) => id !== boatId);
      await AsyncStorage.setItem(key, JSON.stringify(pending));
    }
  }).finally(() => {
    pendingSync = undefined;
  });
  return pendingSync;
}
/** Restore private boat identifiers as well as polars, so a new device can use the cache. */
export function restorePolars() {
  return exclusive(async () => {
    const userId = await signedInUser();
    if (!trackingClient) throw new Error("Sign in to sync polars.");
    const { data, error } = await trackingClient
      .from("polar_library")
      .select("boat_id,boat_document,document")
      .eq("user_id", userId)
      .limit(1000);
    if (error) throw new Error(error.message);
    if ((await signedInUser()) !== userId)
      throw new Error("Sign in to sync polars.");
    for (const row of data ?? []) {
      const polar = validatePolar(row.document as Polar),
        fleet = await privateFleet();
      if (!fleet.boats.some((b) => b.id === row.boat_id)) {
        const b = row.boat_document;
        await savePrivateBoat({
          id: row.boat_id,
          name: typeof b?.name === "string" ? b.name : "Boat",
          className: typeof b?.className === "string" ? b.className : "",
          sailNumber: typeof b?.sailNumber === "string" ? b.sailNumber : "",
          ...(typeof b?.manufacturer === "string"
            ? { manufacturer: b.manufacturer }
            : {}),
          ...(typeof b?.model === "string" ? { model: b.model } : {}),
          ...(typeof b?.variant === "string" ? { variant: b.variant } : {}),
          ...(typeof b?.lengthM === "number" &&
          b.lengthM > 0 &&
          b.lengthM <= 200
            ? { lengthM: b.lengthM }
            : {}),
        });
      }
      if (
        !(await polarRepository.read(row.boat_id)).polars.some(
          (p) => p.id === polar.id,
        )
      )
        await polarRepository.add(row.boat_id, polar);
    }
    return privateFleet();
  });
}
