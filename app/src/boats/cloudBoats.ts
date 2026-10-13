import { trackingClient, trackingRpc } from "../tracking/client";
import {
  privateFleet,
  importOwnedBoat,
  linkedRaceBoat,
  reservePublicBoatId,
  type PrivateBoat,
} from "./privateBoats";
import { polarRepository } from "../polar/repository";
import { boatPolarCurves } from "../../../packages/shared/src/polar/repository";
import {
  validatePolar,
  type Polar,
} from "../../../packages/shared/src/polar/model";
export type OwnedBoat = Omit<PrivateBoat, "catalogPolar"> & {
  updatedAt: string;
  polar?: Polar;
};
export async function boatAccount() {
  if (!trackingClient) return null;
  const { data, error } = await trackingClient.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}
async function requireAccount(userId?: string) {
  const user = await boatAccount();
  if (!user || (userId && user.id !== userId))
    throw new Error("Sign in to publish or refresh your boats.");
  return user;
}
export async function ownedBoats(): Promise<OwnedBoat[]> {
  const user = await boatAccount();
  if (!user) return [];
  const boats = await trackingRpc<OwnedBoat[]>("my_owned_boats");
  await requireAccount(user.id);
  return boats;
}
/** Sync owned boat identities down; never upload private records during refresh. */
export async function refreshOwnedBoats() {
  const user = await boatAccount();
  if (!user) return privateFleet();
  const boats = await trackingRpc<OwnedBoat[]>("my_owned_boats");
  for (const cloud of boats) {
    await requireAccount(user.id);
    if (linkedRaceBoat(await privateFleet(), cloud.id)) continue;
    const { id, updatedAt, polar, ...details } = cloud;
    if (polar) validatePolar(polar);
    await importOwnedBoat(
      {
        ...details,
        className: details.className ?? "",
        sailNumber: details.sailNumber ?? "",
        catalogPolar: polar,
      },
      id,
    );
  }
  return privateFleet();
}
export function publicBoatProfile(boat: PrivateBoat, polar?: Polar) {
  return JSON.parse(
    JSON.stringify({
      name: boat.name,
      className: boat.className,
      sailNumber: boat.sailNumber,
      manufacturer: boat.manufacturer,
      model: boat.model,
      variant: boat.variant,
      lengthM: boat.lengthM,
      weightKg: boat.weightKg,
      waterlineLengthM: boat.waterlineLengthM,
      draftM: boat.draftM,
      airDraftM: boat.airDraftM,
      beamM: boat.beamM,
      polar: polar
        ? {
            id: polar.id,
            name: polar.name,
            version: polar.version,
            source: polar.source,
            createdAt: polar.createdAt,
            sourceUrl: polar.sourceUrl,
            sourceVersion: polar.sourceVersion,
            speedBasis: polar.speedBasis,
            points: polar.points.map(({ tws, twa, speed }) => ({
              tws,
              twa,
              speed,
            })),
          }
        : undefined,
    }),
  );
}
export async function publishBoat(localId: string, expected?: OwnedBoat) {
  const user = await requireAccount();
  // Reserving is queued after any pending field save, so the upload reads saved edits.
  const id = await reservePublicBoatId(localId);
  const boat = (await privateFleet()).boats.find((b) => b.id === localId);
  if (!boat) throw new Error("No boats found");
  const { reference } = boatPolarCurves(await polarRepository.read(localId));
  await requireAccount(user.id);
  const result = await trackingRpc<OwnedBoat>("publish_private_boat", {
    bid: id,
    profile: publicBoatProfile(boat, reference),
    expected: expected?.updatedAt ?? null,
  });
  await requireAccount(user.id);
  return result;
}
