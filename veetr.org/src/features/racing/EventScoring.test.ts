import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newSeries,
  id,
  standingsForView,
  eventStandings,
  validateSeries,
  materializeEvents,
} from "./domain";
test("heat discards produce event ranks, then independent series discards apply", () => {
  const s = newSeries();
  s.boats = ["A", "B"].map((name) => ({
    id: id(),
    name,
    sailNumber: "",
    className: "",
    categoryId: s.categories[0].id,
  }));
  s.events = [
    {
      id: id(),
      name: "Event 1",
      order: 1,
      weight: 1,
      completed: true,
      discards: [{ from: 4, discard: 1 }],
    },
    {
      id: id(),
      name: "Event 2",
      order: 2,
      weight: 1,
      completed: true,
      discards: [],
    },
  ];
  s.races = Array.from({ length: 5 }, (_, i) => ({
    id: id(),
    eventId: s.events![i < 4 ? 0 : 1].id,
    name: `Heat ${i + 1}`,
    date: "2026-09-07",
    order: i + 1,
    weight: 1,
    status: "published",
    entries: s.boats.map((b) => b.id),
    results: (i < 3 ? [...s.boats] : [...s.boats].reverse()).map((b, j) => ({
      boatId: b.id,
      status: "FINISHED",
      position: j + 1,
    })),
  }));
  validateSeries(s);
  const first = eventStandings(s, s.events[0]);
  assert.equal(first[0].id, s.boats[0].id);
  assert.equal(first[0].countedTotal, 3);
  assert.equal(first[0].discardedRaceIds.length, 1);
  assert.equal(standingsForView(s)[0].rawTotal, 1);
  assert.equal(standingsForView(s)[0].discardedRaceIds.length, 0);
  s.discards = [{ from: 2, discard: 1 }];
  assert.equal(standingsForView(s)[0].countedTotal, 0);
  s.events[1].completed = false;
  assert.equal(standingsForView(s)[0].discardedRaceIds.length, 0);
  s.races[3].results = [];
  assert.equal(eventStandings(s, s.events[0])[0].discardedRaceIds.length, 0);
  s.discards = [{ from: 2, discard: 2 }];
  assert.throws(() => validateSeries(s), /discard/);
});
test("legacy races migrate into single-heat events without mutating results", () => {
  const s = newSeries();
  s.races = [
    {
      id: id(),
      name: "Old race",
      date: "2026-09-07",
      order: 1,
      weight: 2,
      status: "draft",
      entries: [],
      results: [],
    },
  ];
  const old = s.races[0].id;
  materializeEvents(s);
  assert.equal(s.events![0].id, old);
  assert.equal(s.events![0].weight, 2);
  assert.equal(s.races[0].weight, 1);
  assert.equal(s.races[0].eventId, old);
  validateSeries(s);
});

test("race starting points allow negative series scores while heats count equally", () => {
  const s = newSeries();
  s.boats = ["A", "B", "C"].map(name => ({id:id(), name, sailNumber:"", className:"", categoryId:s.categories[0].id}));
  s.events = [{id:id(), name:"24h", order:1, weight:10, completed:true, discards:[]}];
  s.races = [{id:id(), eventId:s.events[0].id, name:"Heat", date:"2026-09-23", order:1, weight:10, status:"published", entries:s.boats.map(b=>b.id), results:s.boats.map((b,i)=>({boatId:b.id,status:"FINISHED",position:i+1}))}];
  assert.deepEqual(eventStandings(s,s.events[0]).map(b=>b.rawTotal), [1,2,3]);
  assert.deepEqual(standingsForView(s).map(b=>b.rawTotal), [0,1,2]);
  s.events[0].startingPoints = -1;
  s.events[0].countAs = 2; // Legacy imported repeat counts no longer duplicate races.
  s.discards = [{from:2,discard:1}];
  validateSeries(s);
  assert.deepEqual(standingsForView(s).map(b=>b.rawTotal), [-1,0,1]);
  assert.equal(standingsForView(s)[0].scores.length, 1);
  assert.equal(standingsForView(s)[0].discardedRaceIds.length, 0);
  s.events.push({...s.events[0],id:id(),name:"Next race",order:2,startingPoints:0});
  s.races.push({...s.races[0],id:id(),eventId:s.events[1].id,order:2});
  s.discards = [{from:2,discard:1}];
  assert.deepEqual(standingsForView(s).map(b=>b.countedTotal), [-1,0,1]);
  assert.equal(standingsForView(s)[0].discardedRaceIds[0],s.events[1].id);
  s.events[0].startingPoints = 0.5;
  assert.throws(()=>validateSeries(s));
});
