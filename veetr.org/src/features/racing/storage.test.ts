import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { newSeries, setFinish, normalize, validateSeries } from "./domain";
import { saveLocal, loadLocal, acknowledge, type LocalRecord } from "./storage";
// Test-only entrants: two boats in one category and one in another.
function raceFixture() {
  const series = newSeries("Test series", 2026);
  series.boats = [0, 0, 1].map((category, index) => ({
    id: crypto.randomUUID(),
    name: `Boat ${index + 1}`,
    sailNumber: String(index + 1),
    className: "",
    categoryId: series.categories[category].id,
  }));
  series.races = [
    {
      id: crypto.randomUUID(),
      name: "Test race",
      date: "2026-09-06",
      order: 1,
      weight: 1,
      status: "draft",
      entries: series.boats.map((boat) => boat.id),
      results: [],
    },
  ];
  return series;
}
test("durable outbox, newer edits during sync, stale tab protection", async () => {
  const record: LocalRecord = {
    series: newSeries("Offline regatta"),
    revision: 0,
    pending: true,
    owner: "local",
    mutationId: "first",
    savedAt: new Date().toISOString(),
  };
  await saveLocal(record);
  assert.deepEqual(
    (await loadLocal()).find((r) => r.series.id === record.series.id),
    record,
  );
  const newer = { ...record, mutationId: "second" };
  await saveLocal(newer, "first");
  const ack = acknowledge(newer, record, 1);
  assert.equal(ack.pending, true);
  assert.equal(ack.revision, 1);
  assert.equal(ack.mutationId, "second");
  assert.equal(acknowledge(newer, newer, 2).pending, false);
  await assert.rejects(
    saveLocal({ ...record, mutationId: "stale" }, "first"),
    /LOCAL_CONFLICT/,
  );
  assert.equal(
    (await loadLocal()).find((r) => r.series.id === record.series.id)
      ?.mutationId,
    "second",
  );
});
test("finish, status replacement, reorder and locked guard", () => {
  const s = raceFixture(),
    r = s.races[0];
  setFinish(r, s.boats, s.boats[0].id, "FINISHED");
  setFinish(r, s.boats, s.boats[1].id, "FINISHED");
  assert.deepEqual(
    r.results.map((r) => r.position),
    [1, 2],
  );
  r.results.reverse();
  normalize(r, s.boats);
  assert.equal(r.results[0].boatId, s.boats[1].id);
  assert.equal(r.results[0].position, 1);
  setFinish(r, s.boats, s.boats[1].id, "DNF");
  assert.equal(r.results.find((r) => r.boatId === s.boats[0].id)?.position, 1);
  r.status = "locked";
  assert.doesNotThrow(() => setFinish(r, s.boats, s.boats[0].id, "DNS"));
});
test("local validation rejects ambiguous order, invalid entry, incomplete publication", () => {
  const s = raceFixture();
  validateSeries(s);
  s.races.push({ ...s.races[0], id: crypto.randomUUID() });
  assert.throws(() => validateSeries(s), /unique order/);
  s.races.pop();
  s.races[0].entries.push("unknown");
  assert.throws(() => validateSeries(s), /registered boats/);
  s.races[0].entries.pop();
  s.races[0].status = "published";
  assert.doesNotThrow(() => validateSeries(s));
});

test("shared results remain editable while earlier saves await synchronization", async () => {
  const { stageChange } = await import("./storage");
  const s = raceFixture();
  s.races[0].status = "published";
  const old: LocalRecord = {
    series: s,
    revision: 1,
    pending: false,
    mutationId: "old",
    owner: "official",
    savedAt: "",
  };
  const next = structuredClone(s);
  setFinish(next.races[0], next.boats, next.boats[0].id, "FINISHED");
  const pending = stageChange(old, next);
  const later = structuredClone(next);
  setFinish(later.races[0], later.boats, later.boats[1].id, "FINISHED");
  assert.equal(stageChange(pending, later).series.races[0].results.length, 2);
});

test("double taps do not alter finishing order; undo follows recording order after reordering", async () => {
  const { recordFinish, undoLastResult } = await import("./domain");
  const s = raceFixture(),
    r = s.races[0];
  recordFinish(r, s.boats, s.boats[0].id);
  recordFinish(r, s.boats, s.boats[1].id);
  recordFinish(r, s.boats, s.boats[0].id);
  assert.equal(r.results[0].boatId, s.boats[0].id);
  assert.equal(r.results.length, 2);
  r.results.reverse();
  normalize(r, s.boats);
  undoLastResult(r, s.boats);
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].boatId, s.boats[0].id);
  assert.equal(r.results[0].position, 1);
});

test("mixed-fleet arrival order preserves category places after clearing", () => {
  const s = raceFixture(),
    r = s.races[0];
  const first = s.boats[0],
    other = s.boats.find((b) => b.categoryId !== first.categoryId)!,
    second = s.boats[1];
  for (const boat of [first, other, second])
    setFinish(r, s.boats, boat.id, "FINISHED");
  assert.deepEqual(
    r.results.map((v) => v.boatId),
    [first.id, other.id, second.id],
  );
  assert.deepEqual(
    r.results.map((v) => v.position),
    [1, 1, 2],
  );
  r.results = r.results.filter((v) => v.boatId !== first.id);
  normalize(r, s.boats);
  assert.deepEqual(
    r.results.map((v) => v.position),
    [1, 1],
  );
});

test("overall standings default to fleet finish order; category filtering preserves category scoring", async () => {
  const { standingsForView } = await import("./domain");
  const s = raceFixture(),
    r = s.races[0];
  for (const b of [s.boats[2], s.boats[0], s.boats[1]])
    setFinish(r, s.boats, b.id, "FINISHED");
  assert.deepEqual(
    standingsForView(s).map((b) => [b.id, b.countedTotal]),
    [
      [s.boats[2].id, 1],
      [s.boats[0].id, 2],
      [s.boats[1].id, 3],
    ],
  );
  assert.deepEqual(
    standingsForView(s, s.boats[0].categoryId).map((b) => b.countedTotal),
    [1, 2],
  );
  assert.deepEqual(
    r.results.map((v) => v.position),
    [1, 1, 2],
  );
});
