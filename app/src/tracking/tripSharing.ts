import * as Crypto from "expo-crypto";
import { trackingClient, trackingRpc } from "./client";
import { trackingStore } from "./database";
import type { TripSharing } from "./model";
export type TripBoat = { id: string; name: string; color: string };
export type TripVisibility = TripSharing["visibility"];
export const tripLink = (token: string) =>
  `${(process.env.EXPO_PUBLIC_SITE_URL || "https://veetr.org").replace(/\/$/, "")}/trips/#trip=${encodeURIComponent(token)}`;
let queue: Promise<unknown> = Promise.resolve();
const cancelling = new Set<string>();
let pendingSync: Promise<void> | null = null;
function exclusive<T>(action: () => Promise<T>) {
  const next = queue.then(action);
  queue = next.catch(() => {});
  return next;
}
async function signedIn() {
  const auth = await trackingClient?.auth.getSession();
  const user = auth?.data.session?.user;
  if (!user)
    throw new Error(
      "Sign in to your Veetr account in Settings to choose a boat or share a trip.",
    );
  return user.id;
}
export async function tripBoats() {
  await signedIn();
  return trackingRpc<TripBoat[]>("my_trip_boats");
}
export async function createTripBoat(name: string) {
  await signedIn();
  if (!name.trim() || name.trim().length > 120)
    throw new Error("Enter a boat name (up to 120 characters).");
  const id = Crypto.randomUUID();
  await trackingRpc("create_boat", {
    boat_id: id,
    boat_name: name.trim(),
    boat_class: "",
    boat_length: null,
  });
  return (await tripBoats()).find((b) => b.id === id)!;
}
export const selectTripBoat = (id: string, boat: TripBoat) =>
  exclusive(async () => {
    const userId = await signedIn();
    const store = await trackingStore();
    const trip = await store.trip(id);
    if (!trip || trip.session.mode !== "local")
      throw new Error("Boat selection is available for personal trips.");
    if (trip.session.sharing)
      throw new Error("The boat is fixed once a trip has been uploaded.");
    if (trip.session.userId && trip.session.userId !== userId)
      throw new Error("Sign in as the trip recorder.");
    if (!(await tripBoats()).some((b) => b.id === boat.id))
      throw new Error("Boat access is no longer available.");
    await store.updateTrip(id, {
      boatId: boat.id,
      boatName: boat.name,
      userId,
    });
  });
export const setTripSharing = (
  id: string,
  visibility: TripVisibility,
  title: string,
) => {
  if (visibility === "private") cancelling.add(id);
  return exclusive(async () => {
    const userId = await signedIn(),
      store = await trackingStore();
    const trip = await store.trip(id);
    if (
      !trip ||
      (trip.session.mode !== "local" && trip.session.phase !== "stopping")
    )
      throw new Error(
        "Finish race tracking before publishing your personal copy.",
      );
    if (trip.session.userId && trip.session.userId !== userId)
      throw new Error("Sign in as the trip recorder.");
    if (!trip.session.boatId) throw new Error("Choose a boat first.");
    const previous = trip.session.sharing;
    if (previous && previous.userId !== userId)
      throw new Error("Sign in as the trip recorder.");
    const sharing: TripSharing = {
      ...previous,
      id: previous?.id ?? Crypto.randomUUID(),
      userId,
      title: title.trim() || "My sailing trip",
      visibility: previous?.visibility ?? "private",
      uploaded: previous?.uploaded ?? 0,
      pendingVisibility: visibility,
      error: undefined,
    };
    await store.updateTrip(id, { userId, sharing });
    await syncOne(id);
  }).finally(() => {
    if (visibility === "private") cancelling.delete(id);
  });
};
async function syncOne(id: string) {
  const store = await trackingStore(),
    trip = await store.trip(id);
  if (!trip?.session.sharing) return;
  const sharing = { ...trip.session.sharing },
    s = trip.session;
  try {
    if ((await signedIn()) !== sharing.userId)
      throw new Error(
        "Sign in as the trip recorder to finish syncing sharing.",
      );
    const rpc = <T>(action: string, payload: Record<string, unknown> = {}) =>
      trackingRpc<T>("write_trip", {
        action,
        payload: { ...payload, id: sharing.id },
      });
    const remote = await rpc<TripSharing>("create", {
      boatId: s.boatId,
      startedAt: s.startedAt,
      stoppedAt:
        s.phase === "stopping"
          ? (s.stoppedAt ?? s.lastRecordedAt ?? s.startedAt)
          : null,
      title: sharing.title,
    });
    sharing.token = remote.token;
    sharing.visibility = remote.visibility;
    // Privacy changes have priority over uploading an offline backlog.
    if (sharing.pendingVisibility === "private") {
      const result = await rpc<TripSharing>("publish", {
        visibility: "private",
        title: sharing.title,
      });
      Object.assign(sharing, {
        token: result.token,
        visibility: "private",
        pendingVisibility: undefined,
      });
    }
    // A revoked/private trip is not continuously uploaded without a new sharing request.
    if (sharing.visibility !== "private" || sharing.pendingVisibility) {
      for (
        let i = 0;
        i < 10 && sharing.uploaded < trip.points.length && !cancelling.has(id);
        i++
      ) {
        const points = trip.points
          .slice(sharing.uploaded, sharing.uploaded + 500)
          .map((p, i) => ({ ...p, seq: sharing.uploaded + i + 1 }));
        const count = await rpc<number>("ingest", { points });
        if (count !== points.length)
          throw new Error("Incomplete upload; retry sharing.");
        sharing.uploaded += count;
        await store.updateTrip(id, { sharing: { ...sharing } });
      }
      if (
        sharing.pendingVisibility &&
        trip.points.length > 0 &&
        sharing.uploaded === trip.points.length &&
        !cancelling.has(id)
      ) {
        const result = await rpc<TripSharing>("publish", {
          visibility: sharing.pendingVisibility,
          title: sharing.title,
        });
        Object.assign(sharing, {
          visibility: result.visibility,
          token: result.token,
          pendingVisibility: undefined,
        });
      }
    }
    // Finish only after the final backlog is uploaded; finished shared trips are immutable.
    if (s.phase === "stopping" && !sharing.finished &&
      ((sharing.visibility === "private" && !sharing.pendingVisibility) || sharing.uploaded === trip.points.length)) {
      const result = await rpc<TripSharing>("finish", {
        stoppedAt: s.stoppedAt ?? s.lastRecordedAt ?? s.startedAt,
      });
      Object.assign(sharing, {
        finished: true,
        token: result.token,
        visibility: result.visibility,
      });
    }
    sharing.error = undefined;
    await store.updateTrip(id, { sharing });
  } catch (error) {
    await store.updateTrip(id, {
      sharing: {
        ...sharing,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
export const syncSharedTrip = (id: string) => exclusive(() => syncOne(id));
export const syncPendingTrips = () => {
  if (pendingSync) return pendingSync;
  pendingSync = exclusive(async () => {
    const store = await trackingStore();
    for (const id of await store.pendingShares()) await syncOne(id);
  }).finally(() => {
    pendingSync = null;
  });
  return pendingSync;
};
