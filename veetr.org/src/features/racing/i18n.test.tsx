import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { detectLanguage, setLanguage, t } from "./i18n";
import { SeriesBrowser } from "./SeriesBrowser";
import { cs, en } from "./translations";

test("language negotiation respects a saved choice and browser preference order", () => {
  assert.equal(detectLanguage(["cs-CZ", "en-US"]), "cs");
  assert.equal(detectLanguage(["en-GB", "cs"]), "en");
  assert.equal(detectLanguage(["de-DE", "cs-CZ"]), "cs");
  assert.equal(detectLanguage(["cs-CZ"], "en"), "en");
  assert.equal(detectLanguage(["cs"], "invalid"), "cs");
  assert.equal(detectLanguage(["fr"]), "en");
  assert.equal(detectLanguage([]), "en");
});
test("language changes translate UI and interpolated labels without translating data", () => {
  try {
    setLanguage("cs");
    assert.equal(t("Category for {name}", {name: "Aurora"}), "Kategorie lodi Aurora");
    const html = renderToStaticMarkup(<SeriesBrowser seriesList={[]} location={{}} navigate={() => {}} edit={() => {}} create={() => {}} />);
    assert.match(html, /Nový seriál/);
    assert.match(html, /Řadit podle: Název/);
    assert.doesNotMatch(html, /New series/);
    assert.deepEqual(Object.keys(cs).sort(), Object.keys(en).sort());
  } finally { setLanguage("en"); }
  assert.equal(t("New series"), "New series");
});
