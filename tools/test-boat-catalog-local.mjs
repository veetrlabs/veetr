import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Supply local status JSON from `supabase status -o json`; never accepts a hosted URL.
const env = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (!["127.0.0.1", "localhost"].includes(new URL(env.API_URL).hostname))
  throw new Error("Local Docker Supabase only");
const request = async (path, body, key = env.ANON_KEY) => {
  const response = await fetch(`${env.API_URL}/rest/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
};
const search = await request("rpc/search_boat_catalog", { p_query: "J/24" });
assert.equal(search.status, 200);
assert.ok(search.data.length);
assert.ok(search.data.length <= 30);
const normalized = await request("rpc/search_boat_catalog", { p_query: "J24" });
assert.deepEqual(normalized.data, search.data);
const source = await request("boat_catalog_source?select=revision,row_count");
assert.equal(source.status, 200);
assert.ok(source.data[0].row_count >= 1000);
const configurations = await request("rpc/boat_catalog_configurations", {
  p_model_key: search.data[0].model_key,
  p_offset: 0,
});
assert.equal(configurations.status, 200);
assert.ok(configurations.data.length);
const selected = configurations.data[0];
const detail = await request("rpc/boat_catalog_detail", {
  p_id: selected.id,
  p_revision: selected.revision,
});
assert.equal(detail.status, 200);
assert.ok(detail.data.points.length >= 16);
assert.ok(detail.data.draft_m > 0);
assert.ok(!("owner" in detail.data));
assert.equal(
  (
    await request("rpc/boat_catalog_detail", {
      p_id: selected.id,
      p_revision: "stale",
    })
  ).data,
  null,
);
assert.equal(
  (await request("rpc/search_boat_catalog", { p_query: "%" })).data.length,
  0,
);
for (const path of [
  "boat_catalog",
  "boat_catalog_source",
  "boat_catalog_staging",
])
  assert.ok((await request(path, {})).status >= 400);
assert.ok((await request("boat_catalog_staging?select=*")).status >= 400);
const args = {
  p_run_id: crypto.randomUUID(),
  p_revision: "a".repeat(40),
  p_year: 2024,
  p_source_url: "test",
  p_sha256: "b".repeat(64),
};
assert.ok((await request("rpc/install_boat_catalog", args)).status >= 400);
assert.ok(
  (await request("rpc/install_boat_catalog", args, env.SERVICE_ROLE_KEY))
    .status >= 400,
);
assert.deepEqual(
  (await request("boat_catalog_source?select=revision,row_count")).data,
  source.data,
);
const denied = await fetch(`${env.API_URL}/functions/v1/import-boat-catalog`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.ANON_KEY}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});
assert.equal(denied.status, 401);
console.log(
  JSON.stringify({
    passed: true,
    rows: source.data[0].row_count,
    modelsFound: search.data.length,
    polarPoints: detail.data.points.length,
    checks: [
      "search",
      "punctuation",
      "variants",
      "polar",
      "stale revision",
      "read-only access",
      "admin-only import",
      "failed publication preserves catalog",
    ],
  }),
);
