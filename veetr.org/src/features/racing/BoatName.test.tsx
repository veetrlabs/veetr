import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BoatName } from "./BoatName";
test("boats with additional details render only a profile link", () => {
  const html = renderToStaticMarkup(
    <BoatName
      boat={{
        id: "boat",
        name: "Mistral",
        sailNumber: "CZE 101",
        className: "Micro",
        length: 5.5,
        categoryId: "race",
        skipper: "Shared skipper",
        crewNames: "Shared crew",
      }}
    />,
  );
  assert.equal(html, '<a href="?boat=boat">Mistral</a>');
});
test("boats without extra details link to their profile", () => {
  const html = renderToStaticMarkup(
    <BoatName
      boat={{
        id: "boat",
        name: "Mistral",
        sailNumber: "CZE 101",
        className: "",
        categoryId: "race",
      }}
    />,
  );
  assert.equal(html, '<a href="?boat=boat">Mistral</a>');
});
