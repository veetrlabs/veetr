import { test } from "node:test";
import assert from "node:assert/strict";
import { newSeries, id, eventEntries, setEventEntries } from "./domain";
function fixture() {
  const s = newSeries();
  s.boats = ["A", "B"].map((name) => ({id: id(), name, sailNumber: "", className: "", categoryId: s.categories[0].id}));
  const eventId = id();
  s.events = [{id: eventId, name: "Race", order: 1, weight: 1, completed: false, discards: []}];
  s.races = [1, 2].map((order) => ({id: id(), eventId, name: `Heat ${order}`, order, date: "2026-09-07", weight: 1, status: "draft", entries: [s.boats[order - 1].id], results: []}));
  return {s, eventId};
}
test("legacy heat registrations combine into a race list and edits apply to every heat", () => {
  const {s, eventId} = fixture();
  assert.deepEqual(eventEntries(s, eventId), s.boats.map((b) => b.id));
  const selected = [s.boats[0].id];
  setEventEntries(s, eventId, selected);
  assert.deepEqual(eventEntries(s, eventId), selected);
  assert.ok(s.races.every((r) => JSON.stringify(r.entries) === JSON.stringify(selected)));
  setEventEntries(s, eventId, []);
  assert.deepEqual(eventEntries(s, eventId), []);
});
test("race registration cannot remove a recorded boat in any heat", () => {
  const {s, eventId} = fixture();
  s.races[1].results.push({boatId: s.boats[1].id, status: "FINISHED", position: 1});
  const before = JSON.stringify(s);
  assert.throws(() => setEventEntries(s, eventId, [s.boats[0].id]), /Clear/);
  assert.equal(JSON.stringify(s), before);
  assert.throws(() => setEventEntries(s, eventId, [id()]), /series fleet/);
});
test("new races without heats default to the series fleet and retain explicit selection", () => {
  const {s, eventId} = fixture();
  s.races = [];
  assert.deepEqual(eventEntries(s, eventId), s.boats.map((b) => b.id));
  setEventEntries(s, eventId, [s.boats[1].id]);
  assert.deepEqual(eventEntries(s, eventId), [s.boats[1].id]);
});
