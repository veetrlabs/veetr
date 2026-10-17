import {
  targetSpeed,
  performance,
  performanceSmoother,
} from "../../../../packages/shared/src/polar/engine";
import { importPolar } from "../../../../packages/shared/src/polar/import";
import {
  buildLearnedPoints,
  percentile,
  observationRejection,
} from "../../../../packages/shared/src/polar/learning";
import { PolarRepository } from "../../../../packages/shared/src/polar/repository";
import { polarCurve } from "../../../../packages/shared/src/polar/diagram";
import type { SailingObservation } from "../../../../packages/shared/src/polar/model";
const metadata = {
  id: "p",
  name: "Test",
  version: "1",
  source: "upload" as const,
  createdAt: "2026-10-12T00:00:00Z",
};
const polar = importPolar(
  "TWS,TWA,speed\n6,40,4\n6,80,6\n10,40,6\n10,80,8",
  metadata,
);
test.each([
  [6, 40, 4],
  [6, 60, 5],
  [8, 40, 5],
  [8, 60, 6],
  [8, -60, 6],
  [8, 300, 6],
])("interpolates %s kn / %s degrees", (wind, angle, expected) =>
  expect(targetSpeed(polar, wind, angle)).toBe(expected),
);
test("performance and above 100 percent are not clamped", () => {
  expect(performance(polar, 8, 60, 5)?.performancePercent).toBeCloseTo(83.333);
  expect(performance(polar, 8, 60, 6.6)?.performancePercent).toBeCloseTo(110);
  expect(performance(polar, 8, 60, NaN)).toBeNull();
  expect(
    performance(
      { ...polar, points: [{ tws: 8, twa: 60, speed: 0 }] },
      8,
      60,
      1,
    ),
  ).toBeNull();
});
test("does not extrapolate or bridge missing rows", () => {
  expect(targetSpeed(polar, 4, 60)).toBeNull();
  expect(targetSpeed(polar, 8, 20)).toBeNull();
  expect(
    targetSpeed({ ...polar, points: polar.points.slice(0, 3) }, 8, 60),
  ).toBeNull();
});
test("POL matrix, JSON and strict import validation", () => {
  expect(importPolar("TWA/TWS;6;10\n40;4;6\n80;6;8", metadata).points).toEqual(
    polar.points,
  );
  expect(importPolar(JSON.stringify(polar), metadata).points).toEqual(
    polar.points,
  );
  expect(() => importPolar("TWS,TWA,speed\n6,40,4\n6,40,5", metadata)).toThrow(
    "Duplicate",
  );
  expect(() => importPolar("TWA/TWS;6;10\n40;4", metadata)).toThrow("missing");
  expect(() => importPolar("TWS,TWA,speed\n6,190,4", metadata)).toThrow();
  expect(() => importPolar("TWS,TWA,speed\n6,40,NaN", metadata)).toThrow();
});
test("smooths and resets after missing data, gaps and boat changes", () => {
  const smooth = performanceSmoother();
  expect(smooth(polar, 8, 60, 3, 1000, "a")?.actualSpeed).toBe(3);
  expect(smooth(polar, 8, 60, 6, 2000, "a")?.actualSpeed).toBeLessThan(4);
  expect(smooth(polar, 8, 60, 6, 3000, "b")?.actualSpeed).toBe(6);
  expect(smooth(undefined, 8, 60, 6, 4000, "b")).toBeNull();
  expect(smooth(polar, 8, 60, 3, 5000, "b")?.actualSpeed).toBe(3);
  expect(smooth(polar, 8, 60, 6, 30000, "b")?.actualSpeed).toBe(6);
});
const observations = (count = 100): SailingObservation[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    sessionId: "trip",
    boatId: "boat",
    timestamp: 100000 + i * 5000,
    tws: 8,
    twa: 60,
    speed: 5 + (i % 5) * 0.05,
    heading: 40,
    gpsValid: true,
    windValid: true,
    accuracyM: 5,
    engine: false,
  }));
test("percentile learns an upper envelope, with deterministic buckets and rebuilding", () => {
  expect(percentile([1, 2, 3, 4, 5], 0.9)).toBe(4.6);
  const raw = observations(),
    a = buildLearnedPoints(raw, "boat"),
    b = buildLearnedPoints([...raw].reverse(), "boat");
  expect(a).toEqual(b);
  expect(a.points).toHaveLength(1);
  expect(a.points[0]).toMatchObject({
    tws: 8,
    twa: 60,
    speed: 5.2,
    confidence: { level: "low" },
  });
  expect(raw).toEqual(observations());
  expect(buildLearnedPoints([...raw, ...raw], "boat")).toEqual(a);
});
test("rejects spikes, turns, bad quality, engine, gaps and insufficient coverage", () => {
  const raw = observations();
  raw[40].speed = 40;
  expect(buildLearnedPoints(raw, "boat").points[0].speed).toBeLessThan(6);
  const first = raw[0],
    next = raw[1];
  expect(observationRejection({ ...next, engine: true }, first)).toBe("engine");
  expect(observationRejection({ ...next, twa: -60 }, first)).toBe("turn");
  expect(observationRejection({ ...next, accuracyM: 80 }, first)).toBe(
    "quality",
  );
  expect(observationRejection({ ...next, windValid: false }, first)).toBe(
    "quality",
  );
  expect(observationRejection({ ...next, timestamp: 900000 }, first)).toBe(
    "gap",
  );
  const few = buildLearnedPoints(observations(15), "boat");
  expect(few.points[0].confidence?.level).toBe("unknown");
  expect(
    targetSpeed(
      { ...polar, source: "learned", points: few.points, learning: few.config },
      8,
      60,
    ),
  ).toBeNull();
  expect(buildLearnedPoints(observations(), "other").points).toEqual([]);
  expect(() => buildLearnedPoints(raw, "boat", { percentile: 1 })).toThrow();
});
test("an isolated slow-rise outlier does not increase the envelope", () => {
  const raw = observations(300);
  for (let i = 150; i < 156; i++) raw[i].speed = 5 + (i - 149) * 0.15;
  expect(buildLearnedPoints(raw, "boat").points[0].speed).toBeCloseTo(5.2);
});
test("learned interpolation is limited to neighbouring supported buckets", () => {
  const built = buildLearnedPoints(observations(), "boat");
  const learned = {
    ...polar,
    source: "learned" as const,
    learning: built.config,
    points: [
      { ...built.points[0], twa: 40 },
      { ...built.points[0], twa: 100 },
    ],
  };
  expect(targetSpeed(learned, 8, 60)).toBeNull();
  expect(polarCurve(learned, 8, 10)).not.toContain("NaN");
});
test("cached polars and raw observations survive offline restart; updates serialize", async () => {
  const values = new Map<string, string>(),
    storage = {
      getItem: async (k: string) => values.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        values.set(k, v);
      },
    };
  const repo = new PolarRepository(storage);
  await Promise.all([
    repo.add("boat", polar),
    repo.add("boat", { ...polar, id: "second" }),
  ]);
  await repo.select("boat", "second");
  await repo.saveObservations("boat", "trip", observations());
  const restarted = new PolarRepository(storage);
  expect((await restarted.read("boat")).selectedId).toBe("second");
  expect((await restarted.read("boat")).polars).toHaveLength(2);
  expect(await restarted.observations("boat")).toEqual(observations());
  expect(await restarted.read("other")).toEqual({
    polars: [],
    observationSets: [],
  });
  await expect(repo.select("boat", "missing")).rejects.toThrow();
  await expect(repo.add("boat", polar)).rejects.toThrow();
  expect((await restarted.read("boat")).selectedId).toBe("second");
});

test("keeps the actual tack and excludes gradual sustained turns from learning", () => {
  expect(performance(polar, 8, -60, 5)?.twa).toBe(-60);
  const turning = observations().map((o, i) => ({
    ...o,
    heading: (i * 10) % 360,
  }));
  expect(buildLearnedPoints(turning, "boat").points).toEqual([]);
});


test("a boat keeps one reference and a measured curve; replacement never touches another boat", async () => {
  const values = new Map<string,string>();
  const repo = new PolarRepository({getItem: async k=>values.get(k)??null,setItem:async(k,v)=>{values.set(k,v);}});
  await repo.setPolar("a",polar);
  await repo.setPolar("b",{...polar,id:"other"});
  await repo.setPolar("a",{...polar,id:"measured",source:"learned"});
  expect((await repo.read("a")).selectedId).toBe(polar.id);
  await repo.setPolar("a",{...polar,id:"replacement"});
  const current=await repo.read("a");
  expect(current.polars.map(p=>p.id)).toEqual(["replacement","measured"]);
  expect(current.selectedId).toBe("replacement");
  expect((await repo.read("b")).selectedId).toBe("other");
  await repo.setPolar("learned-only",{...polar,id:"measured",source:"learned"});
  expect((await repo.read("learned-only")).selectedId).toBe("measured");
});
