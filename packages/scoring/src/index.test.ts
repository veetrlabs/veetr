import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDiscards,
  calculateRacePoints,
  calculateSeriesStandings,
  defaultPolicy,
  statuses,
  type Score,
} from "./index";
const scores = (points: number[]): Score[] =>
  points.map((points, i) => ({
    raceId: String(i),
    order: i,
    points,
    eligible: true,
    status: "FINISHED",
  }));
test("M1 historical fixture", () => {
  const s = scores([2, 8, 12, 13, 9]);
  const d = calculateDiscards(s);
  assert.deepEqual(d, ["3"]);
  assert.equal(
    s.reduce((n, s) => n + s.points, 0),
    44,
  );
  assert.equal(
    s.filter((s) => !d.includes(s.raceId)).reduce((n, s) => n + s.points, 0),
    31,
  );
});
for (const [n, expected] of [
  [0, 0],
  [1, 0],
  [3, 0],
  [4, 1],
  [8, 2],
  [12, 3],
])
  test(`${n} eligible races`, () =>
    assert.equal(calculateDiscards(scores(Array(n).fill(3))).length, expected));
test("equal worst scores discard latest deterministically", () =>
  assert.deepEqual(calculateDiscards(scores([4, 4, 4, 4])), ["3"]));
for (const status of statuses.filter(s => s !== "SCORED"))
  test(`default ${status}`, () =>
    assert.equal(
      calculateRacePoints({ boatId: "a", status, position: 2 }, 5, 2),
      status === "FINISHED" ? 4 : 12,
    ));
test("custom penalties and weighting", () =>
  assert.equal(
    calculateRacePoints({ boatId: "a", status: "DNS" }, 4, 2, {
      ...defaultPolicy,
      penalties: { ...defaultPolicy.penalties, DNS: 8 },
      weightPoints: (p) => p,
    }),
    8,
  ));
test("eligibility policy", () =>
  assert.equal(
    calculateDiscards(
      scores([1, 2, 3, 4]).map((s) => ({ ...s, eligible: false })),
    ).length,
    0,
  ));
test("empty series", () =>
  assert.deepEqual(calculateSeriesStandings([], []), []));
const boats = [
  { id: "a", categoryId: "small" },
  { id: "b", categoryId: "small" },
  { id: "c", categoryId: "large" },
];
test("category penalties, single competitor, and unranked entrants", () => {
  const r = calculateSeriesStandings(boats, [
    {
      id: "r",
      order: 1,
      weight: 1,
      entries: ["a", "b", "c"],
      results: [
        { boatId: "a", status: "DNS" },
        { boatId: "c", status: "FINISHED", position: 1 },
      ],
    },
  ]);
  assert.equal(r.find((b) => b.id === "a")?.rawTotal, 3);
  assert.equal(r.find((b) => b.id === "c")?.rank, 1);
  assert.equal(r.find((b) => b.id === "b")?.rank, 0);
});
test("recent race breaks equal countback; shared configurable", () => {
  const races = [
    {
      id: "1",
      order: 1,
      weight: 1,
      entries: ["a", "b"],
      results: [
        { boatId: "a", status: "FINISHED" as const, position: 1 },
        { boatId: "b", status: "FINISHED" as const, position: 2 },
      ],
    },
    {
      id: "2",
      order: 2,
      weight: 1,
      entries: ["a", "b"],
      results: [
        { boatId: "a", status: "FINISHED" as const, position: 2 },
        { boatId: "b", status: "FINISHED" as const, position: 1 },
      ],
    },
  ];
  assert.equal(calculateSeriesStandings(boats.slice(0, 2), races)[0].id, "b");
  assert.deepEqual(
    calculateSeriesStandings(boats.slice(0, 2), races, {
      ...defaultPolicy,
      tieBreak: "shared",
    }).map((r) => r.rank),
    [1, 1],
  );
});
test("invalid inputs rejected", () => {
  assert.throws(() =>
    calculateRacePoints({ boatId: "a", status: "FINISHED", position: 0 }, 2),
  );
  assert.throws(() =>
    calculateRacePoints({ boatId: "a", status: "DNS" }, 2, 0),
  );
  assert.throws(() =>
    calculateDiscards([], { ...defaultPolicy, discardEvery: 0 }),
  );
  assert.throws(() =>
    calculateSeriesStandings(boats, [
      {
        id: "r",
        order: 1,
        weight: 1,
        entries: ["a", "b"],
        results: [
          { boatId: "a", status: "FINISHED", position: 1 },
          { boatId: "b", status: "FINISHED", position: 1 },
        ],
      },
    ]),
  );
});
