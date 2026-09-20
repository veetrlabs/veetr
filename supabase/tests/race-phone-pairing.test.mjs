import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID as id } from "node:crypto";

test("race phone capabilities enforce pairing, readiness, activation, privacy and revocation", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(f, dir), "utf8"));
  const owner = id(),
    skipper = id(),
    other = id(),
    unverified = id();
  await db.query(
    "insert into auth.users values($1,'official@example.test',now()),($2,'skipper@example.test',now()),($3,'other@example.test',now()),($4,'unverified@example.test',null)",
    [owner, skipper, other, unverified],
  );
  await db.query("insert into public.series_creators values($1)", [owner]);
  async function login(uid, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      uid ?? "",
    ]);
    await db.exec(`set role ${role}`);
  }
  async function rpc(name, args = []) {
    return (
      await db.query(
        `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) result`,
        args,
      )
    ).rows[0].result;
  }
  await login(owner);
  const doc = JSON.parse(
    await readFile(
      new URL(
        "../../veetr.org/imports/orlik-2026/series.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await rpc("save_series", [doc, 0, id()]);
  const sid = doc.id,
    bid = doc.boats[0].id;

  const eventId = doc.events?.[0]?.id ?? doc.races[0].id;
  const eid = await rpc("configure_race_tracking", [
    sid,
    eventId,
    new Date().toISOString(),
  ]);
  const link = await rpc("create_race_tracking_link", [eid, bid]);
  const secret = id() + id(),
    another = id() + id(),
    session = id();
  await login(null, "anon");
  await assert.rejects(
    db.query("select * from public.race_tracking_links"),
    /permission denied/,
  );
  await assert.rejects(rpc("race_phone_info", [link.id]), /permission denied/);
  await assert.rejects(
    rpc("configure_race_tracking", [sid, eventId, new Date().toISOString()]),
    /permission denied/,
  );
  assert.equal(
    (await rpc("preview_race_tracking_link", [link.token])).boatId,
    bid,
  );
  await assert.rejects(
    rpc("claim_race_tracking_link", [link.token, null]),
    /Invalid phone/,
  );
  await rpc("claim_race_tracking_link", [link.token, secret]);
  await rpc("claim_race_tracking_link", [link.token, secret]); // lost-response retry
  await assert.rejects(
    rpc("claim_race_tracking_link", [link.token, another]),
    /another phone/,
  );
  await assert.rejects(
    rpc("arm_race_phone", [link.id, another, session]),
    /Invalid phone/,
  );
  const armed = await rpc("arm_race_phone", [link.id, secret, session]);
  assert.equal(armed.ready, true);
  assert.equal(armed.active, false);
  await rpc("arm_race_phone", [link.id, secret, session]);
  const point = (seq, recordedAt = new Date().toISOString()) => ({
    seq,
    recordedAt,
    latitude: 49,
    longitude: 14,
    accuracyM: 5,
    sogMps: 2,
    cogDeg: 90,
    source: "phone",
  });
  await rpc("ingest_race_phone_points", [link.id, secret, session, [point(1)]]);
  await db.exec("reset role");
  assert.equal(
    (await db.query("select count(*)::int n from public.race_phone_points"))
      .rows[0].n,
    0,
  );
  await login(owner);
  await rpc("set_race_tracking_active", [eid, true]);
  await login(null, "anon");
  assert.equal(
    (await rpc("race_phone_status", [link.id, secret, session])).active,
    true,
  );
  const live = point(2);
  await rpc("ingest_race_phone_points", [link.id, secret, session, [live]]);
  await rpc("ingest_race_phone_points", [link.id, secret, session, [live]]);
  assert.equal((await rpc("public_tracking_positions", [sid])).length, 1);
  await assert.rejects(
    rpc("ingest_race_phone_points", [link.id, another, session, [point(3)]]),
    /Invalid phone/,
  );
  await login(owner);
  await rpc("set_race_tracking_active", [eid, false]);
  await login(null, "anon");
  await rpc("ingest_race_phone_points", [link.id, secret, session, [point(3)]]);
  assert.equal((await rpc("public_tracking_positions", [sid])).length, 0);
  assert.equal(
    (await rpc("public_regatta_replay", [sid, live.recordedAt])).length,
    1,
  );
  await db.exec("reset role");
  assert.equal(
    (await db.query("select count(*)::int n from public.race_phone_points"))
      .rows[0].n,
    1,
  );
  await login(owner);
  await rpc("set_race_tracking_active", [eid, true]);
  // A replaced link must never take over the existing ready phone silently.
  const accountLink = await rpc("connect_my_race_phone", [eid, bid]);
  await login(null, "anon");
  const connected = await rpc("claim_race_tracking_link", [
    accountLink.token,
    another,
  ]);
  await assert.rejects(
    rpc("arm_race_phone", [connected.linkId, another, id()]),
    /Another phone/,
  );
  await login(owner);
  await rpc("revoke_race_tracking_link", [link.id]);
  await login(null, "anon");
  assert.equal(
    (await rpc("race_phone_status", [link.id, secret, session])).valid,
    false,
  );
  assert.equal(
    (await rpc("public_regatta_replay", [sid, live.recordedAt])).length,
    0,
  );
  await rpc("stop_race_phone", [
    link.id,
    secret,
    session,
    new Date().toISOString(),
  ]);
  await assert.rejects(
    rpc("arm_race_phone", [link.id, secret, session]),
    /expired or revoked/,
  );
  const next = id();
  await rpc("arm_race_phone", [connected.linkId, another, next]);
  const finalPoint = point(1);
  await rpc("ingest_race_phone_points", [
    connected.linkId,
    another,
    next,
    [finalPoint],
  ]);
  await login(owner);
  await rpc("finish_race_tracking", [eid]);
  await assert.rejects(
    rpc("set_race_tracking_active", [eid, true]),
    /has ended/,
  );
  await login(null, "anon");
  assert.equal(
    (await rpc("race_phone_status", [connected.linkId, another, next])).ready,
    false,
  );
  assert.equal((await rpc("public_tracking_positions", [sid])).length, 0);
  assert.equal(
    (await rpc("public_regatta_replay", [sid, finalPoint.recordedAt])).length,
    1,
  );
  await assert.rejects(
    rpc("arm_race_phone", [connected.linkId, another, id()]),
    /expired or revoked/,
  );
});
