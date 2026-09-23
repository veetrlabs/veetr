export const statuses = [
  "FINISHED",
  "DNS",
  "DNF",
  "DSQ",
  "RET",
  "OCS",
  "SCORED",
] as const;
export type ResultStatus = (typeof statuses)[number];
export interface Result {
  boatId: string;
  status: ResultStatus;
  position?: number;
  points?: number;
  finishedAt?: string;
  recordedOrder?: number;
}
export interface Race {
  id: string;
  order: number;
  weight: number;
  entries: string[];
  results: Result[];
}
export interface Boat {
  id: string;
  categoryId: string;
}
export interface Policy {
  discardCount?: number;
  allowTiedPositions?: boolean;
  allowNegativePoints?: boolean;
  weightPoints: (points: number, weight: number) => number;
  penalties: Record<Exclude<ResultStatus, "FINISHED">, number | "entries+1">;
  eligibleStatuses: readonly ResultStatus[];
  discardEvery: number;
  tieBreak: "countback-recent" | "shared";
}
export const defaultPolicy: Policy = {
  weightPoints: (points, weight) => points * weight,
  penalties: {
    DNS: "entries+1",
    DNF: "entries+1",
    DSQ: "entries+1",
    RET: "entries+1",
    OCS: "entries+1",
    SCORED: "entries+1",
  },
  eligibleStatuses: statuses,
  discardEvery: 4,
  tieBreak: "countback-recent",
};
export function calculateRacePoints(
  result: Result,
  entries: number,
  weight = 1,
  policy = defaultPolicy,
): number {
  if (
    !Number.isInteger(entries) ||
    entries < 1 ||
    !Number.isFinite(weight) ||
    weight <= 0
  )
    throw new Error("Invalid entry count or weight");
  if (!statuses.includes(result.status))
    throw new Error("Unknown result status");
  if (
    result.status === "FINISHED" &&
    (!Number.isInteger(result.position) ||
      result.position! < 1 ||
      result.position! > entries)
  )
    throw new Error("Invalid finishing position");
  if (result.points !== undefined) {
    if (!Number.isFinite(result.points) || (result.points < 0 && !policy.allowNegativePoints)) throw new Error("Invalid imported score");
    return policy.weightPoints(result.points, weight);
  }
  if (result.status === "SCORED") throw new Error("Imported result requires points");
  const penalty =
    result.status === "FINISHED"
      ? result.position!
      : policy.penalties[result.status];
  const points = policy.weightPoints(
    penalty === "entries+1" ? entries + 1 : penalty,
    weight,
  );
  if (!Number.isFinite(points) || points < 0) throw new Error("Invalid score");
  return points;
}
export interface Score {
  raceId: string;
  order: number;
  points: number;
  eligible: boolean;
  status: ResultStatus;
}
export function calculateDiscards(
  scores: Score[],
  policy = defaultPolicy,
): string[] {
  if (!Number.isInteger(policy.discardEvery) || policy.discardEvery < 1)
    throw new Error("Invalid discard interval");
  const eligible = scores.filter((s) => s.eligible);
  return [...eligible]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.order - a.order ||
        a.raceId.localeCompare(b.raceId),
    )
    .slice(
      0,
      policy.discardCount ?? Math.floor(eligible.length / policy.discardEvery),
    )
    .map((s) => s.raceId);
}
export function calculateRaceResults(
  race: Race,
  boats: Boat[],
  policy = defaultPolicy,
) {
  if (
    new Set(race.entries).size !== race.entries.length ||
    new Set(race.results.map((r) => r.boatId)).size !== race.results.length
  )
    throw new Error("Duplicate entry or result");
  const positions = new Set<string>();
  return race.results.map((result) => {
    const boat = boats.find((b) => b.id === result.boatId);
    if (!boat || !race.entries.includes(boat.id))
      throw new Error("Result has no entry");
    const entries = boats.filter(
      (b) => b.categoryId === boat.categoryId && race.entries.includes(b.id),
    ).length;
    if (result.status === "FINISHED") {
      const key = boat.categoryId + ":" + result.position;
      if (positions.has(key) && !policy.allowTiedPositions)
        throw new Error("Duplicate finishing position");
      positions.add(key);
    }
    return {
      ...result,
      points: calculateRacePoints(result, entries, race.weight, policy),
    };
  });
}
export function calculateSeriesStandings(
  boats: Boat[],
  races: Race[],
  policy = defaultPolicy,
) {
  if (
    new Set(boats.map((b) => b.id)).size !== boats.length ||
    new Set(races.map((r) => r.id)).size !== races.length
  )
    throw new Error("Duplicate boat or race");
  const scored = races.map((r) => ({
    race: r,
    results: calculateRaceResults(r, boats, policy),
  }));
  const rows = boats.map((boat) => {
    const scores: Score[] = scored.flatMap(({ race, results }) => {
      const r = results.find((r) => r.boatId === boat.id);
      return r
        ? [
            {
              raceId: race.id,
              order: race.order,
              points: r.points,
              status: r.status,
              eligible: policy.eligibleStatuses.includes(r.status),
            },
          ]
        : [];
    });
    const discardedRaceIds = calculateDiscards(scores, policy);
    const counted = scores.filter((s) => !discardedRaceIds.includes(s.raceId));
    return {
      ...boat,
      scores,
      discardedRaceIds,
      rawTotal: scores.reduce((n, s) => n + s.points, 0),
      countedTotal: counted.reduce((n, s) => n + s.points, 0),
      rank: 0,
      tieBreak: {
        countback: counted.map((s) => s.points).sort((a, b) => a - b),
        recent: [...scores].sort((a, b) => b.order - a.order),
      },
    };
  });
  function compare(a: (typeof rows)[number], b: (typeof rows)[number]) {
    // Boats without a recorded result are unranked, never zero-point winners.
    if (!a.scores.length || !b.scores.length)
      return Number(!a.scores.length) - Number(!b.scores.length);
    let diff = a.countedTotal - b.countedTotal;
    if (diff || policy.tieBreak === "shared") return diff;
    for (
      let i = 0;
      i < Math.max(a.tieBreak.countback.length, b.tieBreak.countback.length);
      i++
    ) {
      diff =
        (a.tieBreak.countback[i] ?? Infinity) -
        (b.tieBreak.countback[i] ?? Infinity);
      if (diff) return diff;
    }
    for (const race of [...races].sort((a, b) => b.order - a.order)) {
      diff =
        (a.scores.find((s) => s.raceId === race.id)?.points ?? Infinity) -
        (b.scores.find((s) => s.raceId === race.id)?.points ?? Infinity);
      if (diff) return diff;
    }
    return 0;
  }
  rows.sort(
    (a, b) =>
      a.categoryId.localeCompare(b.categoryId) ||
      compare(a, b) ||
      a.id.localeCompare(b.id),
  );
  for (const category of new Set(boats.map((b) => b.categoryId))) {
    const group = rows.filter((b) => b.categoryId === category);
    group.forEach((row, i) => {
      row.rank = !row.scores.length
        ? 0
        : i > 0 && compare(group[i - 1], row) === 0
          ? group[i - 1].rank
          : i + 1;
    });
  }
  return rows;
}
