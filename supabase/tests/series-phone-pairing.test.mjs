import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID as id } from "node:crypto";

test("series pairing reuses one credential while keeping races and legacy links isolated", async (t) => {
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
  doc.events[0].scheduledStart = new Date().toISOString();
  await rpc("save_series", [doc, 0, id()]);
  const sid = doc.id,
    bid = doc.boats[0].id;

  const secret = id() + id(),
    otherSecret = id() + id();
  const event1 = doc.events[0].id;
  const event2 = id();
  const heat = structuredClone(
    doc.races.find((r) => r.eventId === event1 && r.entries.includes(bid)),
  );
  heat.id = id();
  heat.eventId = event2;
  heat.status = "published";
  heat.order = Math.max(...doc.races.map((r) => r.order)) + 1;
  doc.events.push({
    ...structuredClone(doc.events[0]),
    id: event2,
    completed: false,
    name: "Second race",
    order: Math.max(...doc.events.map((e) => e.order)) + 1,
    scheduledStart: new Date().toISOString(),
  });
  doc.races.push(heat);
  doc.events[0].completed = false;
  await rpc("save_series", [doc, 1, id()]);
  const legacyEvent = await rpc("configure_race_tracking", [sid, event1]);
  const legacy = await rpc("create_race_tracking_link", [legacyEvent, bid]);
  const link = await rpc("create_series_tracking_link", [sid, bid]);
  await assert.rejects(
    rpc("create_series_tracking_link", [sid, bid]),
    /already exists/,
  );
  await db.exec("reset role");
  await db.query("update public.boats set owner_id=$1 where id=$2", [
    owner,
    bid,
  ]);
  await login(owner);
  await assert.rejects(
    rpc("prepare_series_invitation_email", [link.token, other]),
    /configured boat administrator/,
  );
  const mail = await rpc("prepare_series_invitation_email", [
    link.token,
    owner,
  ]);
  assert.equal(mail.series, doc.name);
  assert.equal(mail.token, link.token);
  await assert.rejects(
    rpc("prepare_series_invitation_email", [link.token, owner]),
    /Wait a minute/,
  );
  await login(other);
  await assert.rejects(
    rpc("create_series_tracking_link", [sid, bid]),
    /official/,
  );
  await assert.rejects(rpc("series_tracking_roster", [sid]), /official/);
  await assert.rejects(
    rpc("revoke_series_tracking_link", [link.id]),
    /official/,
  );
  await login(null, "anon");
  await assert.rejects(
    db.query("select * from public.series_tracking_links"),
    /permission denied/,
  );
  await assert.rejects(
    rpc("series_phone_status", [link.id, secret]),
    /credential/,
  );
  assert.equal(
    await rpc("preview_race_tracking_link", [link.token]),
    null,
    "old apps do not interpret series credentials as race links",
  );
  assert.equal(
    (await rpc("preview_tracking_invitation", [legacy.token])).linkId,
    legacy.id,
  );
  await assert.rejects(
    db.query("select private.series_phone_info($1)", [link.id]),
    /permission denied/,
  );
  await assert.rejects(
    rpc("mark_series_invitation_sent", [link.id]),
    /permission denied/,
  );
  const preview = await rpc("preview_tracking_invitation", [link.token]);
  assert.equal(preview.scope, "series");
  assert.ok(preview.races.some((r) => r.eventId === event2));
  assert.equal(preview.connected, false);
  await assert.rejects(
    rpc("claim_series_tracking_link", [link.token, "short"]),
    /credential/,
  );
  await rpc("claim_series_tracking_link", [link.token, secret]);
  await rpc("claim_series_tracking_link", [link.token, secret]);
  await assert.rejects(
    rpc("claim_series_tracking_link", [link.token, otherSecret]),
    /another phone/,
  );
  await assert.rejects(
    rpc("connect_series_race_phone", [link.id, otherSecret, event1]),
    /credential/,
  );
  await assert.rejects(
    rpc("connect_series_race_phone", [link.id, secret, id()]),
    /eligible/,
  );
  await login(owner);
  const beforeReady = (await rpc("race_tracking_roster", [sid]))
    .find((e) => e.id === legacyEvent)
    .phones.filter((p) => p.boatId === bid);
  assert.equal(beforeReady.length, 1);
  assert.equal(
    beforeReady[0].connected,
    true,
    "series pairing is shown before the first race is armed",
  );
  await login(null, "anon");
  // A real race in another series is never selectable with this capability.
  const foreignSeries = id(),
    foreignEvent = id();
  await db.exec("reset role");
  await db.query(
    "insert into public.series(id,owner_id,name,year,status,document) values($1,$2,'Other series',2026,'active','{}')",
    [foreignSeries, owner],
  );
  await db.query(
    "insert into public.race_tracking_events(series_id,event_id,name,scheduled_start,expires_at) values($1,$2,'Other race',now(),now()+interval '18 hours')",
    [foreignSeries, foreignEvent],
  );
  await login(null, "anon");
  await assert.rejects(
    rpc("connect_series_race_phone", [link.id, secret, foreignEvent]),
    /eligible/,
  );
  await login(owner);
  doc.events[0].scheduledStart = new Date(
    Date.now() + 24 * 3600000,
  ).toISOString();
  await rpc("save_series", [doc, 2, id()]);
  await login(null, "anon");
  await assert.rejects(
    rpc("connect_series_race_phone", [link.id, secret, event1]),
    /12 hours/,
  );
  await login(owner);
  doc.events[0].scheduledStart = new Date().toISOString();
  await rpc("save_series", [doc, 3, id()]);
  await login(null, "anon");
  const first = await rpc("connect_series_race_phone", [
    link.id,
    secret,
    event1,
  ]);
  assert.equal(
    (await rpc("connect_series_race_phone", [link.id, secret, event1])).linkId,
    first.linkId,
    "retries reuse the race link",
  );
  const firstSession = id();
  await rpc("arm_race_phone", [first.linkId, secret, firstSession]);
  await login(owner);
  await rpc("set_race_tracking_active", [first.eventId, true]);
  await login(null, "anon");
  const record = async (race, session, seq = 1) =>
    rpc("ingest_race_phone_points", [
      race.linkId,
      secret,
      session,
      JSON.stringify([
        {
          seq,
          recordedAt: (await db.query("select now()::text as stamp")).rows[0]
            .stamp,
          latitude: 49,
          longitude: 14,
          accuracyM: 5,
          source: "phone",
        },
      ]),
    ]);
  await record(first, firstSession);
  const second = await rpc("connect_series_race_phone", [
    link.id,
    secret,
    event2,
  ]);
  assert.notEqual(first.linkId, second.linkId);
  await assert.rejects(
    rpc("arm_race_phone", [second.linkId, secret, id()]),
    /Another phone/,
  );
  await login(owner);
  await rpc("finish_race_tracking", [first.eventId]);
  await login(null, "anon");
  assert.equal(
    (await rpc("series_phone_status", [link.id, secret])).valid,
    true,
    "finishing a race preserves the series pairing",
  );
  assert.ok(
    !(await rpc("series_phone_status", [link.id, secret])).races.some(
      (r) => r.eventId === event1,
    ),
  );
  const secondSession = id();
  await rpc("arm_race_phone", [second.linkId, secret, secondSession]);
  assert.equal(
    (await rpc("race_phone_status", [second.linkId, secret])).active,
    false,
    "pairing never opens tracking",
  );
  await login(owner);
  await rpc("set_race_tracking_active", [second.eventId, true]);
  await login(null, "anon");
  assert.equal(
    (await rpc("race_phone_status", [second.linkId, secret])).active,
    true,
  );
  await assert.rejects(
    rpc("claim_series_tracking_link", [legacy.token, secret]),
    /expired or revoked/,
    "legacy credentials cannot gain series access",
  );
  await login(owner);
  await login(null, "anon");
  await record(second, secondSession);
  await assert.rejects(
    rpc("ingest_race_phone_points", [
      second.linkId,
      secret,
      firstSession,
      "[]",
    ]),
    /not ready/,
  );
  await db.exec("reset role");
  const counts = await db.query(
    "select session_id,count(*)::int n from public.race_phone_points group by session_id",
  );
  assert.deepEqual(
    new Set(counts.rows.map((r) => r.session_id)),
    new Set([firstSession, secondSession]),
  );
  assert.ok(counts.rows.every((r) => r.n === 1));
  await db.exec("reset role; begin");
  await db.query(
    "delete from public.race_results where race_id in (select race_id from public.race_entries where series_id=$1 and boat_id=$2) and boat_id=$2",
    [sid, bid],
  );
  await db.query(
    "delete from public.race_entries where series_id=$1 and boat_id=$2",
    [sid, bid],
  );
  await db.query(
    "delete from public.series_entries where series_id=$1 and boat_id=$2",
    [sid, bid],
  );
  await login(null, "anon");
  assert.equal(
    (await rpc("series_phone_status", [link.id, secret])).valid,
    false,
  );
  assert.equal(
    (await rpc("race_phone_status", [second.linkId, secret])).valid,
    false,
  );
  await assert.rejects(
    rpc("connect_series_race_phone", [link.id, secret, event2]),
    /revoked/,
  );
  await db.exec("rollback");
  await login(owner);
  const roster = await rpc("series_tracking_roster", [sid]);
  assert.equal(roster[0].connected, true);
  await rpc("revoke_series_tracking_link", [link.id]);
  await login(null, "anon");
  assert.equal(
    (await rpc("series_phone_status", [link.id, secret])).valid,
    false,
  );
  assert.equal(
    (await rpc("race_phone_status", [second.linkId, secret])).valid,
    false,
  );
  await assert.rejects(
    rpc("connect_series_race_phone", [link.id, secret, event2]),
    /revoked/,
  );
  await assert.rejects(
    rpc("arm_race_phone", [second.linkId, secret, id()]),
    /revoked/,
  );
  await record(second, secondSession, 2);
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.race_phone_points where session_id=$1",
        [secondSession],
      )
    ).rows[0].n,
    1,
    "revoked credentials cannot upload more points",
  );
  await login(owner);
  const replacement = await rpc("create_series_tracking_link", [sid, bid]);
  await login(null, "anon");
  assert.equal(
    (await rpc("claim_series_tracking_link", [replacement.token, otherSecret]))
      .valid,
    true,
  );
});
