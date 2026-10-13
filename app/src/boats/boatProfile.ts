import type { PrivateBoat } from "./privateBoats";
import type { Polar } from "../../../packages/shared/src/polar/model";
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
export function accountBoatProfile(boat: PrivateBoat, polar?: Polar) {
  return JSON.parse(
    JSON.stringify({
      ...publicBoatProfile(boat, polar),
      catalogId: boat.catalogId,
      catalogRevision: boat.catalogRevision,
      catalogLabel: boat.catalogLabel,
    }),
  );
}
