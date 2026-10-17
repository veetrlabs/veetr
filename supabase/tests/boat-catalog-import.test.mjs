import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCatalogLiteral,
  normalizeCatalog,
} from "../functions/import-boat-catalog/catalog.mjs";
import { createCatalogImportHandler } from "../functions/import-boat-catalog/handler.mjs";
const fixture = () =>
  Array.from({ length: 1000 }, (_, i) => ({
    country: `C${i % 10}`,
    sailnumber: `C/${i}`,
    boat: {
      type: "J/24",
      builder: "J Boats",
      year: 1980,
      sizes: { loa: 7.32, beam: 2.71, draft: 1.22 },
    },
    vpp: {
      angles: [52, 60, 75, 90, 110, 120, 135, 150],
      speeds: [6, 8],
      ...Object.fromEntries(
        [52, 60, 75, 90, 110, 120, 135, 150].map((a) => [a, [4, 5]]),
      ),
      beat_angle: [45, 45],
      beat_vmg: [3, 4],
    },
  }));
test("safe parser accepts Python literals, rejects code and pollution", () => {
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        parseCatalogLiteral("[{'a':None, 52:[1.5,True,False], 's':'it\\\'s'}]"),
      ),
    ),
    [{ a: null, 52: [1.5, true, false], s: "it's" }],
  );
  for (const s of [
    "[__import__('os')]",
    "[1];alert(1)",
    "[{'a':1,'a':2}]",
    "[NaN]",
  ])
    assert.throws(() => parseCatalogLiteral(s));
  const row = parseCatalogLiteral("[{'__proto__':{'polluted':True}}]")[0];
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(row), null);
});
test("normalization retains variants and knots, derives beat speed and omits personal fields", () => {
  const raw = fixture();
  raw[0].owner = "private";
  raw[0].name = "private";
  const { rows } = normalizeCatalog(raw, 2024);
  assert.equal(rows.length, 1000);
  assert.equal(rows[0].model_key, "j24");
  assert.equal(rows[0].points.find((p) => p.twa === 52).speed, 4);
  assert.ok(
    Math.abs(
      rows[0].points.find((p) => p.twa === 45).speed -
        3 / Math.cos(Math.PI / 4),
    ) < 1e-9,
  );
  assert.ok(!JSON.stringify(rows).includes("private"));
  assert.notEqual(rows[0].id, rows[1].id);
  assert.throws(() => normalizeCatalog(raw.slice(0, 34), 2024), /Incomplete/);
  raw.forEach((r) => (r.country = "AUS"));
  assert.throws(() => normalizeCatalog(raw, 2024), /Incomplete/);
});
test("import is admin-only and fixed-host; failed validation never calls database", async () => {
  let calls = 0;
  const handler = createCatalogImportHandler(
    { SUPABASE_SERVICE_ROLE_KEY: "secret", SUPABASE_URL: "http://local" },
    async () => {
      calls++;
      return Response.json([]);
    },
  );
  const req = (body, key = "secret") =>
    new Request("http://local", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
  assert.equal((await handler(req({}, "anon"))).status, 401);
  assert.equal(calls, 0);
  assert.equal((await handler(req({ revision: "https://evil" }))).status, 400);
  assert.equal(calls, 0);
  assert.equal((await handler(req({}))).status, 400);
  assert.equal(calls, 1);
});
test("successful import publishes once after validating complete source", async () => {
  let calls = 0;
  const handler = createCatalogImportHandler(
    { SUPABASE_SERVICE_ROLE_KEY: "secret", SUPABASE_URL: "http://local" },
    async (url, init) => {
      calls++;
      if (calls === 1) return Response.json(fixture());
      if (url.endsWith("/stage_boat_catalog")) {
        assert.equal(JSON.parse(init.body).p_rows.length, 100);
        return Response.json(100);
      }
      assert.equal(url, "http://local/rest/v1/rpc/install_boat_catalog");
      return Response.json(1000);
    },
  );
  const response = await handler(
    new Request("http://local", {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
      body: "{}",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).count, 1000);
  assert.equal(calls, 12);
});
