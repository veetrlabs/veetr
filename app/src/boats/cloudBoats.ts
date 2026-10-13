import { accountBoatProfile, publicBoatProfile } from "./boatProfile";
export { publicBoatProfile } from "./boatProfile";
import { trackingClient, trackingRpc } from "../tracking/client";
import {
  privateFleet,
  syncAccountBoat,
  rememberAccountBoat,
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
  privateUpdatedAt?: string | null;
  publicUpdatedAt?: string | null;
  publiclyVisible?: boolean;
  uploadPublic?: boolean;
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
    throw new Error("Sign in to upload or refresh your boats.");
  return user;
}
export async function ownedBoats(): Promise<OwnedBoat[]> {
  const user = await boatAccount();
  if (!user) return [];
  const boats = await trackingRpc<OwnedBoat[]>("my_account_boats");
  await requireAccount(user.id);
  return boats;
}
/** Sync owned boat identities down; never upload private records during refresh. */
export async function refreshOwnedBoats() {
  const user = await boatAccount();
  if (!user) return privateFleet();
  const boats = await trackingRpc<OwnedBoat[]>("my_account_boats");
  for (const cloud of boats) {
    await requireAccount(user.id);
    const {
      id,
      updatedAt,
      privateUpdatedAt,
      publicUpdatedAt,
      publiclyVisible,
      uploadPublic,
      polar,
      ...details
    } = cloud;
    if (polar) validatePolar(polar);
    await syncAccountBoat(
      {
        ...details,
        className: details.className ?? "",
        sailNumber: details.sailNumber ?? "",
        catalogPolar: polar,
      },
      id,
      user.id,
    );
  }
  return privateFleet();
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

export async function uploadBoat(
  localId: string,
  publish: boolean,
  expected?: OwnedBoat,
) {
  const user = await requireAccount();
  const id = await reservePublicBoatId(localId);
  const boat = (await privateFleet()).boats.find((b) => b.id === localId);
  if (!boat) throw new Error("No boats found");
  const { reference } = boatPolarCurves(await polarRepository.read(localId));
  const profile = accountBoatProfile(boat, reference);
  await requireAccount(user.id);
  const result = await trackingRpc<OwnedBoat>("upload_account_boat", {
    bid: id,
    profile,
    publish,
    expected_private: expected?.privateUpdatedAt ?? null,
    expected_public: expected?.publicUpdatedAt ?? null,
  });
  await requireAccount(user.id);
  await rememberAccountBoat(localId, user.id, JSON.stringify(profile));
  return result;
}
