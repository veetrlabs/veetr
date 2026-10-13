import { trackingRpc } from "../tracking/client";
import {
  validatePolar,
  type Polar,
} from "../../../packages/shared/src/polar/model";
import type { PrivateBoat } from "./privateBoats";
export type CatalogModel = {
  model_key: string;
  model: string;
  manufacturer: string;
  configurations: number;
};
export type CatalogConfiguration = {
  id: string;
  configuration: string;
  year: number | null;
  draft_m: number;
  main_m2: number | null;
  genoa_m2: number | null;
  spinnaker_m2: number | null;
  asymmetric_m2: number | null;
  revision: string;
};
export type CatalogDetail = CatalogConfiguration & {
  model: string;
  manufacturer: string;
  length_m: number;
  beam_m: number;
  displacement_kg: number | null;
  points: Polar["points"];
  source_url: string;
  source_year: number;
};
export const searchBoatModels = (query: string) =>
  trackingRpc<CatalogModel[]>("search_boat_catalog", { p_query: query });
export const boatConfigurations = (model: string, offset = 0) =>
  trackingRpc<CatalogConfiguration[]>("boat_catalog_configurations", {
    p_model_key: model,
    p_offset: offset,
  });
export async function boatCatalogDetail(config: CatalogConfiguration) {
  const detail = await trackingRpc<CatalogDetail | null>(
    "boat_catalog_detail",
    { p_id: config.id, p_revision: config.revision },
  );
  if (!detail) throw new Error("The catalog changed. Search again.");
  return detail;
}
export function applyCatalogBoat(
  boat: PrivateBoat,
  entry: CatalogDetail,
  polarId: string,
): PrivateBoat {
  const polar = validatePolar({
    id: polarId,
    name: `${entry.model} · ${entry.configuration}`,
    source: "orc",
    version: String(entry.source_year),
    sourceVersion: entry.revision,
    sourceUrl: entry.source_url,
    createdAt: new Date().toISOString(),
    speedBasis: "water",
    points: entry.points,
  });
  return {
    ...boat,
    manufacturer: entry.manufacturer,
    model: entry.model,
    className: entry.model,
    variant: [entry.year, entry.configuration].filter(Boolean).join(" · "),
    lengthM: entry.length_m,
    weightKg: entry.displacement_kg ?? undefined,
    beamM: entry.beam_m,
    draftM: entry.draft_m,
    waterlineLengthM: undefined,
    airDraftM: undefined,
    catalogId: entry.id,
    catalogRevision: entry.revision,
    catalogLabel: entry.model,
    catalogPolar: polar,
  };
}
