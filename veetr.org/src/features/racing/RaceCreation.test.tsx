import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup as render } from "react-dom/server";
import { RaceCreation } from "./RaceCreation";
import { raceEventDetails } from "./SeriesBrowser";
import { newSeries } from "./domain";

test("opening a race form leaves the series untouched and starts with an empty name", () => {
  const series = newSeries("Club series");
  const before = structuredClone(series);
  let saves = 0;
  const html = render(
    <RaceCreation
      series={series}
      save={async () => {
        saves++;
      }}
      navigate={() => {}}
    />,
  );
  assert.equal(saves, 0);
  assert.deepEqual(series, before);
  assert.match(html, /name="name"[^>]*value=""/);
  assert.match(html, /Create race/);
  assert.doesNotMatch(html, /<table|Race 1/);
});

test("race details use the submitted name, start, starting points and discard rules", () => {
  const data = new FormData();
  data.set("name", "  Autumn regatta  ");
  data.set("startingPoints", "-1");
  data.set("scheduledStart", "2026-09-25T10:00");
  const rules = [{ from: 4, discard: 1 }];
  assert.deepEqual(raceEventDetails(data, rules), {
    name: "Autumn regatta",
    weight: 1,
    startingPoints: -1,
    scheduledStart: new Date("2026-09-25T10:00").toISOString(),
    completed: false,
    discards: rules,
  });
});

test("invalid race details cannot be saved", () => {
  const invalid: Record<string, string>[] = [
    { name: "   " },
    { startingPoints: "0.5" },
    { startingPoints: "NaN" },
    { startingPoints: "101" },
    { scheduledStart: "not a date" },
  ];
  for (const overrides of invalid) {
    const data = new FormData();
    for (const [key, value] of Object.entries({
      name: "Regatta",
      weight: "1",
      ...overrides,
    }))
      data.set(key, value);
    assert.throws(() => raceEventDetails(data, []));
  }
});
