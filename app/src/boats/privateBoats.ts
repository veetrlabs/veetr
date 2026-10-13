import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { polarRepository } from "../polar/repository";
import {
  validatePolar,
  type Polar,
} from "../../../packages/shared/src/polar/model";
export type PrivateBoat = {
  id: string;
  name: string;
  className: string;
  sailNumber: string;
  manufacturer?: string;
  model?: string;
  variant?: string;
  lengthM?: number;
  weightKg?: number;
  waterlineLengthM?: number;
  draftM?: number;
  airDraftM?: number;
  beamM?: number;
  catalogId?: string;
  catalogRevision?: string;
  catalogLabel?: string;
  catalogPolar?: Polar;
};
export type Fleet = {
  boats: PrivateBoat[];
  activeId?: string;
  raceLinks?: { server: string; raceBoatId: string; localBoatId: string }[];
};
const raceServer = () => process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = "veetr-private-boats:v1";
let pending: Promise<unknown> = Promise.resolve();
export async function privateFleet(): Promise<Fleet> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : { boats: [] };
}
function update(
  change: (fleet: Fleet) => Fleet | Promise<Fleet>,
  rollback?: () => Promise<void>,
) {
  const next = pending.then(async () => {
    try {
      const fleet = await change(await privateFleet());
      await AsyncStorage.setItem(key, JSON.stringify(fleet));
      return fleet;
    } catch (error) {
      await rollback?.();
      throw error;
    }
  });
  pending = next.catch(() => {});
  return next;
}
export function savePrivateBoat(boat: PrivateBoat) {
  const name = boat.name.trim();
  if (
    boat.lengthM !== undefined &&
    (!Number.isFinite(boat.lengthM) || boat.lengthM <= 0 || boat.lengthM > 200)
  )
    return Promise.reject(new Error("Enter a valid boat length."));
  if (
    boat.weightKg !== undefined &&
    (!Number.isFinite(boat.weightKg) ||
      boat.weightKg <= 0 ||
      boat.weightKg >= 1000000000)
  )
    return Promise.reject(new Error("Enter a valid boat weight."));
  for (const [field, max] of [
    ["waterlineLengthM", 200],
    ["draftM", 30],
    ["airDraftM", 200],
    ["beamM", 100],
  ] as const) {
    const value = boat[field];
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value <= 0 || value > max)
    )
      return Promise.reject(new Error("Enter a valid boat dimension."));
  }
  if (
    boat.waterlineLengthM &&
    boat.lengthM &&
    boat.waterlineLengthM > boat.lengthM
  )
    return Promise.reject(
      new Error("Waterline length cannot exceed overall length."),
    );
  if (boat.catalogPolar) validatePolar(boat.catalogPolar);
  if (!name || name.length > 120)
    return Promise.reject(
      new Error("Enter a boat name (up to 120 characters)."),
    );
  let undo: (() => Promise<void>) | undefined;
  return update(
    async (fleet) => {
      const saved = {
        ...boat,
        id: boat.id || Crypto.randomUUID(),
        name,
        className: boat.className.trim(),
        sailNumber: boat.sailNumber.trim(),
      };
      const previous = fleet.boats.find((b) => b.id === saved.id);
      if (
        saved.catalogPolar &&
        saved.catalogPolar.id !== previous?.catalogPolar?.id
      ) {
        const library = await polarRepository.read(saved.id);
        undo = async () => {
          await polarRepository.restore(saved.id, library);
        };
        await polarRepository.setPolar(saved.id, saved.catalogPolar);
      }
      return {
        ...fleet,
        boats: [...fleet.boats.filter((b) => b.id !== saved.id), saved],
        activeId: fleet.activeId ?? saved.id,
      };
    },
    async () => {
      await undo?.();
    },
  );
}
export function selectPrivateBoat(id?: string) {
  return update((fleet) => {
    if (id && !fleet.boats.some((b) => b.id === id))
      throw new Error("No boats found");
    return { ...fleet, activeId: id };
  });
}
export async function activePrivateBoat() {
  const fleet = await privateFleet();
  return fleet.boats.find((b) => b.id === fleet.activeId);
}
export function deletePrivateBoat(id: string) {
  return update((fleet) => ({
    ...fleet,
    ...(fleet.raceLinks
      ? { raceLinks: fleet.raceLinks.filter((link) => link.localBoatId !== id) }
      : {}),
    boats: fleet.boats.filter((boat) => boat.id !== id),
    activeId: fleet.activeId === id ? undefined : fleet.activeId,
  }));
}

/** Device-only identity mapping. Never changes tracking permissions or trip identifiers. */
export function linkedRaceBoat(fleet: Fleet, raceBoatId: string) {
  const link = fleet.raceLinks?.find(
    (link) => link.server === raceServer() && link.raceBoatId === raceBoatId,
  );
  return fleet.boats.find((boat) => boat.id === link?.localBoatId);
}
export async function localBoatIdForRace(raceBoatId: string) {
  return linkedRaceBoat(await privateFleet(), raceBoatId)?.id ?? raceBoatId;
}
/** Undefined unlinks; null adds a new local boat. Existing links are reused on retries. */
export function linkRaceBoat(
  race: { boatId: string; boatName: string },
  localBoatId: string | null | undefined,
) {
  return update((fleet) => {
    if (!race.boatId) throw new Error("No boats found");
    const existing = linkedRaceBoat(fleet, race.boatId);
    const boat =
      localBoatId === null
        ? (existing ?? {
            id: Crypto.randomUUID(),
            name: race.boatName.trim() || "Boat",
            className: "",
            sailNumber: "",
          })
        : fleet.boats.find((boat) => boat.id === localBoatId);
    if (localBoatId !== undefined && !boat) throw new Error("No boats found");
    const raceLinks = (fleet.raceLinks ?? []).filter(
      (link) => link.server !== raceServer() || link.raceBoatId !== race.boatId,
    );
    if (boat)
      raceLinks.push({
        server: raceServer(),
        raceBoatId: race.boatId,
        localBoatId: boat.id,
      });
    return {
      ...fleet,
      raceLinks,
      boats:
        boat && !fleet.boats.some((b) => b.id === boat.id)
          ? [...fleet.boats, boat]
          : fleet.boats,
      activeId: fleet.activeId ?? boat?.id,
    };
  });
}

export function raceBoatIdForLocal(fleet: Fleet, localBoatId: string) {
  return fleet.raceLinks?.find(
    (link) => link.server === raceServer() && link.localBoatId === localBoatId,
  )?.raceBoatId;
}
/** Persist the publication identity before networking, so retries cannot create duplicates. */
export async function reservePublicBoatId(localBoatId: string) {
  let id = "";
  await update((fleet) => {
    if (!fleet.boats.some((b) => b.id === localBoatId))
      throw new Error("No boats found");
    id = raceBoatIdForLocal(fleet, localBoatId) ?? Crypto.randomUUID();
    if (raceBoatIdForLocal(fleet, localBoatId)) return fleet;
    return {
      ...fleet,
      raceLinks: [
        ...(fleet.raceLinks ?? []),
        { server: raceServer(), raceBoatId: id, localBoatId },
      ],
    };
  });
  return id;
}
/** Add an owned cloud boat once, preserving any existing local link, edits and trips. */
export function importOwnedBoat(
  boat: Omit<PrivateBoat, "id">,
  raceBoatId: string,
) {
  let undo: (() => Promise<void>) | undefined;
  return update(
    async (fleet) => {
      if (linkedRaceBoat(fleet, raceBoatId)) return fleet;
      const saved = { ...boat, id: Crypto.randomUUID() };
      if (saved.catalogPolar) {
        const previous = await polarRepository.read(saved.id);
        undo = () => polarRepository.restore(saved.id, previous).then(() => {});
        await polarRepository.setPolar(saved.id, saved.catalogPolar);
      }
      return {
        ...fleet,
        boats: [...fleet.boats, saved],
        activeId: fleet.activeId ?? saved.id,
        raceLinks: [
          ...(fleet.raceLinks ?? []),
          { server: raceServer(), raceBoatId, localBoatId: saved.id },
        ],
      };
    },
    async () => {
      await undo?.();
    },
  );
}
