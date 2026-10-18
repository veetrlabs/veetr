import { test } from "node:test";
import assert from "node:assert/strict";
import { eventDate, eventIsPublished, newEventHeat, setEventPublished } from "./eventDefaults";
import { newSeries } from "./domain";

test("heats inherit the race date, entries and visibility; publishing is race-wide", () => {
  const series = newSeries();
  series.events = [{id:"event",name:"Half marathon",order:1,weight:1,completed:false,discards:[],entries:["runner"],scheduledStart:new Date(2026,9,18,10,0).toISOString()}];
  const first = newEventHeat(series,"event","Heat 1");
  series.races.push(first);
  setEventPublished(series,"event",true);
  assert.equal(first.date,"2026-10-18");
  assert.equal(first.status,"published");
  assert.deepEqual(first.entries,["runner"]);
  const second = newEventHeat(series,"event","Second");
  series.races.push(second);
  assert.equal(second.date,first.date);
  assert.equal(second.status,"published");
  assert.equal(second.order,first.order+1);
  setEventPublished(series,"event",false);
  assert.ok(series.races.every(r => r.status==="draft"));
  assert.equal(eventIsPublished(series,"event"),false);
  assert.equal(newEventHeat(series,"event","Third").status,"draft");
});

test("legacy race dates are reused and official results stay locked", () => {
  const series = newSeries();
  series.events = [{id:"event",name:"Legacy race",order:1,weight:1,completed:false,discards:[]}];
  const first = newEventHeat(series,"event","Heat 1");
  first.date="2026-10-18"; first.status="locked";
  series.races.push(first);
  assert.equal(eventDate(series,"event"),"2026-10-18");
  setEventPublished(series,"event",true);
  assert.equal(first.status,"locked");
  assert.throws(()=>setEventPublished(series,"event",false),/Unlock/);
  assert.equal(first.status,"locked");
});
