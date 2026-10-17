import { polarRepository } from "./repository";
import { boatPolarCurves } from "../../../packages/shared/src/polar/repository";
import type { Trip } from "../tracking/trip";
import type { Polar } from "../../../packages/shared/src/polar/model";
import { buildLearnedPoints } from "../../../packages/shared/src/polar/learning";
import { tripObservations } from "./observations";
export const tripDashPatterns = [
  "8 4",
  "2 4",
  "12 4 2 4",
  "6 3 2 3",
  "14 5",
  "3 3 9 3",
];
export function boatTripPolars(trips: Trip[], boatId: string) {
  return trips
    .filter(
      (trip) =>
        trip.session.boatId === boatId && trip.session.phase === "stopping",
    )
    .sort(
      (a, b) =>
        b.session.startedAt.localeCompare(a.session.startedAt) ||
        a.session.id.localeCompare(b.session.id),
    )
    .map((trip, index) => {
      const learned = buildLearnedPoints(
        tripObservations(trip.session, trip.points),
        boatId,
      );
      const usable = learned.points.some(
        (p) => p.confidence?.level !== "unknown",
      );
      const polar: Polar | undefined = usable
        ? {
            id: `trip:${trip.session.id}`,
            name: trip.session.tripTitle || trip.session.boatName,
            source: "learned",
            version: trip.session.lastRecordedAt ?? trip.session.startedAt,
            createdAt: trip.session.startedAt,
            speedBasis: "ground",
            points: learned.points,
            learning: learned.config,
          }
        : undefined;
      return {
        trip,
        polar,
        dash: tripDashPatterns[index % tripDashPatterns.length],
        unknown:
          !trip.session.engineUse || trip.session.engineUse === "unknown",
      };
    });
}
export function allTripsPolar(
  trips: Trip[],
  boatId: string,
): Polar | undefined {
  const included = trips.filter(
    (t) =>
      t.session.boatId === boatId &&
      t.session.phase === "stopping" &&
      t.session.engineUse !== "engine-used",
  );
  const learned = buildLearnedPoints(
    included.flatMap((t) => tripObservations(t.session, t.points)),
    boatId,
  );
  if (!learned.points.some((p) => p.confidence?.level !== "unknown")) return;
  return {
    id: `boat-trips:${boatId}`,
    name: "Learned polar",
    source: "learned",
    sourceVersion: "boat-trips:v1",
    version: JSON.stringify(learned.points),
    createdAt: new Date().toISOString(),
    speedBasis: "ground",
    points: learned.points,
    learning: learned.config,
  };
}

export async function refreshBoatTripPolar(trips: Trip[], boatId: string) {
  const state = await polarRepository.read(boatId),
    aggregate = allTripsPolar(trips, boatId),
    measured = boatPolarCurves(state).measured;
  if (aggregate && measured?.version !== aggregate.version)
    return polarRepository.setPolar(boatId, {
      ...aggregate,
      id: `${aggregate.id}:${Date.now()}`,
    });
  if (
    !aggregate &&
    trips.some((trip) => trip.session.boatId === boatId) &&
    measured?.sourceVersion === "boat-trips:v1"
  )
    return polarRepository.clearMeasured(boatId);
  return state;
}
