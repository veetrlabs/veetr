import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup as render } from "react-dom/server";
import { SeriesCreation, seriesFromForm } from "./SeriesCreation";
import { PublicDirectory } from "./PublicDirectory";

function details(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "  Autumn Cup  ",
    year: "2026",
    description: "  Club racing  ",
    status: "draft",
    categories: "Dinghies\nKeelboats",
    ...overrides,
  }))
    data.set(key, value);
  return data;
}

test("every signed-in user gets New series navigation without an inline permission form", () => {
  const html = render(<PublicDirectory signedIn />);
  assert.match(html, /href="\?new-series"[^>]*>New series<\/a>/);
  assert.doesNotMatch(html, /<form|<textarea|Request permission/);
  assert.doesNotMatch(render(<PublicDirectory />), /New series/);
});

test("opening the creation form has blank name and categories and does not create a series", () => {
  let calls = 0;
  const html = render(
    <SeriesCreation
      onCreate={async () => {
        calls++;
      }}
    />,
  );
  assert.equal(calls, 0);
  assert.match(html, /name="name"[^>]*required/);
  assert.match(html, /name="categories"[^>]*><\/textarea>/);
  assert.doesNotMatch(html, /Untitled series|≤ 7 m|&gt; 7 m/);
});

test("submission creates exactly the supplied details with no sample races or boats", () => {
  const series = seriesFromForm(details());
  assert.equal(series.name, "Autumn Cup");
  assert.equal(series.description, "Club racing");
  assert.equal(series.year, 2026);
  assert.equal(series.status, "draft");
  assert.deepEqual(
    series.categories.map((c) => c.name),
    ["Dinghies", "Keelboats"],
  );
  assert.deepEqual(series.races, []);
  assert.deepEqual(series.boats, []);
  assert.equal(new Set(series.categories.map((c) => c.id)).size, 2);
});

test("invalid and placeholder-free empty inputs cannot create a series", () => {
  const invalid: Record<string, string>[] = [
    { name: "   " },
    { year: "" },
    { year: "2026.5" },
    { year: "2201" },
    { categories: "\n " },
    { categories: "Fleet\n Fleet " },
    { status: "invalid" },
  ];
  for (const overrides of invalid) {
    assert.throws(() => seriesFromForm(details(overrides)));
  }
});
