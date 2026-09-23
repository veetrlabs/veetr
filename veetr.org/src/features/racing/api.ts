import { createClient } from "@supabase/supabase-js";
import { validateSeries, type Series } from "./domain";
import type { Database, Json } from "./database.types";
import type { LocalRecord } from "./storage";
const url = import.meta.env?.VITE_SUPABASE_URL,
  key = import.meta.env?.VITE_SUPABASE_ANON_KEY;
export const supabase =
  url && key
    ? createClient<Database>(url, key, {
        global: {
          fetch: (input, init) =>
            fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
        },
      })
    : null;
// Capture recovery even if the auth callback arrives before React mounts.
export let passwordRecoveryRequested = false;
supabase?.auth.onAuthStateChange(event => {
  if (event === "PASSWORD_RECOVERY") passwordRecoveryRequested = true;
});
export async function listRemote(): Promise<
  { document: Series; revision: number; owner_id: string }[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("series")
    .select("document,revision,owner_id");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const document = row.document as unknown as Series;
    validateSeries(document);
    return { ...row, document };
  });
}
export async function pushRemote(record: LocalRecord): Promise<number> {
  if (!supabase) throw new Error("Cloud is not configured");
  const { data, error } = await supabase.rpc("save_series", {
    payload: record.series as unknown as Json,
    expected_revision: record.revision,
    mutation_id: record.mutationId,
  });
  if (error) throw error;
  return data;
}
export async function publicSeries(id: string): Promise<Series> {
  if (!supabase)
    throw new Error("Configure Supabase to view published results");
  const { data, error } = await supabase.rpc("public_standings", {
    series_id: id,
  });
  if (error) throw error;
  if (!data) throw new Error("No published results for this series");
  const series = data as unknown as Series;
  validateSeries(series);
  return series;
}

export interface TeamMember {
  id: string;
  email: string;
  role: "owner" | "admin" | "official";
}
export async function getTeam(seriesId: string): Promise<TeamMember[]> {
  if (!supabase) throw new Error("Cloud is not configured");
  const { data, error } = await supabase.rpc("series_team", {
    series_id: seriesId,
  });
  if (error) throw error;
  return data as unknown as TeamMember[];
}
export async function updateTeamMember(
  seriesId: string,
  email: string,
  role: "official" | "admin" | "remove",
): Promise<void> {
  if (!supabase) throw new Error("Cloud is not configured");
  const { error } = await supabase.rpc("set_series_member", {
    series_id: seriesId,
    member_email: email,
    member_role: role,
  });
  if (error) throw error;
}

export async function signOutAccount(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export interface PublicSeriesSummary {
  id: string;
  name: string;
  year: number;
  description: string;
  status: string;
  raceCount: number;
  boatCount: number;
}
export async function listPublicSeries(): Promise<PublicSeriesSummary[]> {
  if (!supabase)
    throw new Error(
      "Published results are not configured on this installation.",
    );
  const { data, error } = await supabase.rpc("public_series_directory");
  if (error) throw error;
  return data as unknown as PublicSeriesSummary[];
}

export interface RegisteredBoat {
  weightKg?: number;
  trackingColor?: string;
  id: string;
  name: string;
  className?: string;
  length?: number;
}
export async function listBoats(): Promise<RegisteredBoat[]> {
  if (!supabase)
    throw new Error("Boat directory requires a connection to the server.");
  const { data, error } = await supabase.rpc("boat_directory");
  if (error) throw error;
  return data as unknown as RegisteredBoat[];
}
export async function boatResults(boatId: string): Promise<Series[]> {
  if (!supabase) throw new Error("Results require a connection to the server.");
  const { data, error } = await supabase.rpc("boat_results", {
    boat_id: boatId,
  });
  if (error) throw error;
  return data as unknown as Series[];
}
export async function createBoat(boat: RegisteredBoat): Promise<void> {
  if (!supabase) throw new Error("Connect to the server to create a boat.");
  const { data, error } = await supabase.rpc("save_boat_profile", {
    boat_id: boat.id,
    boat_name: boat.name,
    boat_class: boat.className ?? "",
    boat_length: boat.length ?? null,
    boat_weight: boat.weightKg ?? null,
    boat_color: boat.trackingColor ?? null,
  });
  if (error) throw error;
  Object.assign(boat, data);
}

export async function canEditBoat(boatId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("can_edit_boat", {
    boat_id: boatId,
  });
  if (error) throw error;
  return data;
}
export async function updateBoat(
  boat: RegisteredBoat,
  expected: RegisteredBoat,
): Promise<void> {
  if (!supabase) throw new Error("Connect to save boat details.");
  const { error } = await supabase.rpc("save_boat_profile", {
    boat_id: boat.id,
    boat_name: boat.name,
    boat_class: boat.className ?? "",
    boat_length: (boat.length ?? null) as unknown as number,
    boat_weight: boat.weightKg ?? null,
    boat_color: boat.trackingColor ?? null,
    expected: expected as unknown as Json,
  });
  if (error) throw error;
}

export async function deleteRaceEntity(seriesId: string, revision: number, eventId?: string, heatId?: string) {
 if (!supabase) throw new Error("Cloud is not configured");
 const {error} = await supabase.rpc("delete_race_entity", {series_id: seriesId, expected_revision: revision, event_id: eventId, heat_id: heatId});
 if (error) throw error;
}
export async function deleteBoat(boatId: string) {
 if (!supabase) throw new Error("Cloud is not configured");
 const {error} = await supabase.rpc("delete_boat", {boat_id: boatId});
 if (error) throw error;
}


export interface OwnedSeries {
  id: string;
  name: string;
  year: number;
}
export async function listOwnedSeries(userId: string): Promise<OwnedSeries[]> {
  if (!supabase) throw new Error("Cloud is not configured");
  const { data, error } = await supabase.from("series")
    .select("id,name,year").eq("owner_id", userId)
    .order("year", { ascending: false }).order("name");
  if (error) throw error;
  return data ?? [];
}
