import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID as id } from "node:crypto";

test("skipper invitations grant boat management and enforce tracking windows, account binding, revocation and takeover", async (t) => {
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
  const invite = await rpc("invite_boat_skipper", [
    sid,
    bid,
    " SKIPPER@example.test ",
  ]);
  const pending = await rpc("boat_invitation_roster", [sid]);
  assert.equal(pending.invitations[0].email, "skipper@example.test");
  assert.equal(pending.invitations[0].sent, false);
  await assert.rejects(
    rpc("invite_boat_skipper", [sid, bid, "skipper@example.test"]),
    /Wait a minute/,
  );
  await assert.rejects(
    rpc("invite_boat_skipper", [sid, bid, "invalid"]),
    /Valid email/,
  );
  await assert.rejects(
    rpc("invite_boat_skipper", [sid, id(), "someone@example.test"]),
    /Boat manager/,
  );
  const mail = await rpc("prepare_boat_invitation_email", [invite.id]);
  assert.equal(mail.token, invite.token);
  await assert.rejects(
    rpc("prepare_boat_invitation_email", [invite.id]),
    /Wait a minute/,
  );
  await login(null, "anon");
  const preview = await rpc("boat_invitation_preview", [invite.token]);
  assert.equal(preview.boat, doc.boats[0].name);
  assert.equal(preview.email, undefined);
  await assert.rejects(
    rpc("accept_boat_invitation", [invite.token]),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select * from public.boat_invitations"),
    /permission denied/,
  );
  await login(other);
  await assert.rejects(
    rpc("invite_boat_skipper", [sid, bid, "other@example.test"]),
    /Boat manager/,
  );
  await assert.rejects(rpc("boat_invitation_roster", [sid]), /Race official/);
  await assert.rejects(
    rpc("prepare_boat_invitation_email", [invite.id]),
    /Boat manager/,
  );
  await assert.rejects(
    rpc("accept_boat_invitation", [invite.token]),
    /verified email/,
  );
  await login(skipper);
  await rpc("accept_boat_invitation", [invite.token]);
  await rpc("accept_boat_invitation", [invite.token]);
  let mine = await rpc("my_boats");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].boatId, bid);
  assert.equal((await db.query("select * from public.series")).rows.length, 0);
  assert.equal(await rpc("can_edit_boat", [bid]), true);
  await assert.rejects(
    rpc("set_tracking_window", [sid, true]),
    /Race official/,
  );
  await login(owner);
  await rpc("set_tracking_window", [sid, false]);
  await login(skipper);
  assert.equal((await rpc("my_tracking_entries"))[0].open, false);
  await assert.rejects(
    rpc("start_tracking_session", [id(), sid, bid]),
    /Tracking is closed/,
  );
  await login(owner);
  await rpc("set_tracking_window", [sid, true]);
  await rpc("save_series", [doc, 1, id()]);
  await login(skipper);
  mine = await rpc("my_boats");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].open, true);
  assert.equal((await rpc("my_tracking_entries")).length, 1);
  const first = id();
  await rpc("start_replay_tracking_session", [first, sid, bid]);
  const points = [
    {
      seq: 1,
      recordedAt: new Date().toISOString(),
      latitude: 49.5,
      longitude: 14.2,
      accuracyM: 4,
    },
  ];
  await rpc("ingest_tracking_points", [first, points]);
  await rpc("ingest_tracking_points", [first, points]);
  await assert.rejects(
    rpc("start_tracking_session", [id(), sid, bid]),
    /already tracking/,
  );
  await assert.rejects(
    rpc("ingest_tracking_points", [
      first,
      [{ ...points[0], seq: 2, latitude: 100 }],
    ]),
    /check constraint/,
  );
  await login(null, "anon");
  assert.equal((await rpc("public_tracking_positions", [sid])).length, 1);
  await assert.rejects(
    db.query("select * from public.tracking_points"),
    /permission denied/,
  );
  await login(skipper);
  const second = id();
  await rpc("take_over_tracking_session", [second, sid, bid, true]);
  await rpc("take_over_tracking_session", [second, sid, bid, true]);
  await db.exec("reset role");
  let sessions = (
    await db.query("select * from public.tracking_sessions order by started_at")
  ).rows;
  assert.equal(sessions.filter((s) => s.stopped_at === null).length, 1);
  assert.equal(sessions[1].replay_enabled, true);
  await login(other);
  await assert.rejects(
    rpc("take_over_tracking_session", [id(), sid, bid, true]),
    /boat access/,
  );
  await assert.rejects(
    rpc("ingest_tracking_points", [second, points]),
    /authorization lost/,
  );
  await login(skipper);
  await rpc("ingest_tracking_points", [second, points]);
  await login(owner);
  await rpc("set_tracking_window", [sid, false]);
  await login(null, "anon");
  assert.deepEqual(await rpc("public_tracking_positions", [sid]), []);
  await login(skipper);
  await assert.rejects(
    rpc("start_tracking_session", [id(), sid, bid]),
    /Tracking is closed/,
  );
  await login(owner);
  await rpc("set_tracking_window", [sid, true]);
  await rpc("revoke_boat_access", [sid, null, bid, skipper]);
  await login(skipper);
  assert.deepEqual(await rpc("my_boats"), []);
  await assert.rejects(
    rpc("ingest_tracking_points", [second, points]),
    /authorization lost/,
  );
  await assert.rejects(
    rpc("accept_boat_invitation", [invite.token]),
    /unavailable/,
  );
  await login(null, "anon");
  assert.deepEqual(
    await rpc("public_regatta_replay", [sid, new Date().toISOString()]),
    [],
  );
  await login(owner);
  const unconfirmed = await rpc("invite_boat_skipper", [
    sid,
    bid,
    "unverified@example.test",
  ]);
  await login(unverified);
  await assert.rejects(
    rpc("accept_boat_invitation", [unconfirmed.token]),
    /verified email/,
  );
  await login(owner);
  await db.exec("reset role");
  await db.query("update auth.users set email_confirmed_at=null where id=$1",[other]);
  await login(owner);
  const expired = await rpc("invite_boat_skipper", [
    sid,
    bid,
    "other@example.test",
  ]);
  await db.exec("reset role");
  await db.query(
    "update public.boat_invitations set expires_at=now()-interval '1 second' where id=$1",
    [expired.id],
  );
  await db.query("update auth.users set email_confirmed_at=now() where id=$1",[other]);
  await login(other);
  await assert.rejects(
    rpc("accept_boat_invitation", [expired.token]),
    /expired/,
  );
  await login(owner);
  await rpc("revoke_boat_access", [sid, unconfirmed.id]);
  await login(unverified);
  await assert.rejects(
    rpc("accept_boat_invitation", [unconfirmed.token]),
    /unavailable/,
  );
});
