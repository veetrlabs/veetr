import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { calculateSeriesStandings } from "../../packages/scoring/src/index";
import {
  validateSeries,
  type Series,
} from "../../veetr.org/src/features/racing/domain";
const env = Object.fromEntries(
  readFileSync(
    new URL("../../apps/race-control/.env.local", import.meta.url),
    "utf8",
  )
    .trim()
    .split("\n")
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const url = env.VITE_SUPABASE_URL,
  key = env.VITE_SUPABASE_ANON_KEY;
if (
  !url.startsWith("http://127.0.0.1:") &&
  !url.startsWith("http://localhost:")
)
  throw new Error("Integration tests require a local Supabase");
test("real Supabase Auth, RLS, published fixture, and versioned saves", async () => {
  const anon = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await client.auth.signInWithPassword(
    { email: "official@example.test", password: "local-race-control-only" },
  );
  assert.equal(authError, null);
  assert.ok(auth.user);
  const fixture = JSON.parse(
    readFileSync(new URL("./fixture.json", import.meta.url), "utf8"),
  ) as Series;
  const { data: pub, error: pubError } = await anon.rpc("public_standings", {
    series_id: fixture.id,
  });
  assert.equal(pubError, null);
  validateSeries(pub);
  assert.equal(pub.races.length, 5);
  assert.equal(pub.boats[0].skipper, undefined);
  const m1 = calculateSeriesStandings(pub.boats, pub.races).find(
    (b) => b.id === fixture.boats[0].id,
  )!;
  assert.equal(m1.rawTotal, 44);
  assert.equal(m1.countedTotal, 31);
  const { error: privateError } = await anon.from("series").select("*");
  assert.ok(privateError);
  const roster = await client.rpc("series_team", { series_id: fixture.id });
  assert.equal(roster.error, null);
  assert.equal(
    roster.data.find((m) => m.role === "owner").email,
    "official@example.test",
  );
  const forbiddenRoster = await anon.rpc("series_team", {
    series_id: fixture.id,
  });
  assert.ok(forbiddenRoster.error);
  const directory = await anon.rpc("public_series_directory");
  assert.equal(directory.error, null);
  assert.equal(directory.data.find((s) => s.id === fixture.id).boatCount, 13);
  const draft = structuredClone(fixture);
  draft.id = crypto.randomUUID();
  draft.name = "Integration test draft";
  const categoryMap = new Map(
    draft.categories.map((c) => [c.id, crypto.randomUUID()]),
  );
  draft.categories.forEach((c) => (c.id = categoryMap.get(c.id)!));
  draft.boats.forEach((b) => (b.categoryId = categoryMap.get(b.categoryId)!));
  draft.races.forEach((r) => {
    r.id = crypto.randomUUID();
    r.status = "draft";
  });
  const args = {
    payload: draft,
    expected_revision: 0,
    mutation_id: crypto.randomUUID(),
  };
  const first = await client.rpc("save_series", args);
  assert.equal(first.error, null);
  assert.equal(first.data, 1);
  const retry = await client.rpc("save_series", args);
  assert.equal(retry.error, null);
  assert.equal(retry.data, 1);
  const stale = await client.rpc("save_series", {
    ...args,
    mutation_id: crypto.randomUUID(),
  });
  assert.match(stale.error?.message ?? "", /SYNC_CONFLICT/);
  const { data: unpublished } = await anon.rpc("public_standings", {
    series_id: draft.id,
  });
  assert.equal(unpublished, null);
  await client.auth.signOut();
});
