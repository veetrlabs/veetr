import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { randomUUID as id } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("tracking enforces consent, ownership, one reporter, idempotency, timestamps and publication at the database", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    const dir = new URL("../migrations/", import.meta.url);
    for (const f of (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(f, dir), "utf8"));
    const owner = id(),
      editor = id(),
      stranger = id(),
      sid = id(),
      bid = id(),
      cat = id(),
      race = id(),
      session = id();
    await db.query("insert into auth.users values($1,$2),($3,$4),($5,$6)", [
      owner,
      "owner@example.test",
      editor,
      "editor@example.test",
      stranger,
      "stranger@example.test",
    ]);
    await db.query(
      "insert into public.series(id,owner_id,name,year,status,document) values($1,$2,'Regatta',2026,'active','{}')",
      [sid, owner],
    );
    await db.query(
      "insert into public.boats(id,owner_id,name,sail_number) values($1,$2,'Boat','42')",
      [bid, owner],
    );
    await db.query("insert into public.boat_members values($1,$2,'editor')", [
      bid,
      editor,
    ]);
    await db.query("insert into public.race_categories values($1,$2,'Fleet')", [
      cat,
      sid,
    ]);
    await db.query("insert into public.series_entries values($1,$2,$3)", [
      sid,
      bid,
      cat,
    ]);
    await db.query(
      "insert into public.races(id,series_id,name,race_date,race_order,weight,status) values($1,$2,'Heat',current_date,1,1,'published')",
      [race, sid],
    );
    await db.query("insert into public.race_entries values($1,$2,$3)", [
      race,
      sid,
      bid,
    ]);
    const login = async (uid, role = "authenticated") => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        uid || "",
      ]);
      await db.exec(`set role ${role}`);
    };
    const start = (sessionId = session) =>
      db.query("select public.start_tracking_session($1,$2,$3) value", [
        sessionId,
        sid,
        bid,
      ]);
    const feed = async () =>
      (
        await db.query("select public.public_tracking_positions($1) value", [
          sid,
        ])
      ).rows[0].value;
    const send = (points) =>
      db.query("select public.ingest_tracking_points($1,$2) accepted", [
        session,
        JSON.stringify(points),
      ]);
    await login(stranger);
    assert.deepEqual(
      (await db.query("select public.my_tracking_entries() value")).rows[0]
        .value,
      [],
    );
    await assert.rejects(start(), /owner or editor/);
    await login(owner);
    assert.equal(
      (await db.query("select public.my_tracking_entries() value")).rows[0]
        .value[0].boatId,
      bid,
    );
    const first = (await start()).rows[0].value;
    assert.deepEqual(
      (await start()).rows[0].value,
      first,
      "retrying start preserves expiry",
    );
    await assert.rejects(start(id()), /already tracking/);
    await login(editor);
    await assert.rejects(start(id()), /already tracking/);
    const stamp = Date.parse(first.startedAt),
      point = (seq, delta = 0) => ({
        seq,
        recordedAt: new Date(stamp + delta).toISOString(),
        latitude: 49.5 + seq / 10000,
        longitude: 14.1,
        accuracyM: 5,
        sogMps: 3,
        cogDeg: 100,
        source: "phone",
      });
    await assert.rejects(send([point(1)]), /authorization/);
    await assert.rejects(
      db.query("select public.stop_tracking_session($1,now())", [session]),
      /owner/,
    );
    await login(owner);
    assert.equal((await send([point(2)])).rows[0].accepted, 1);
    assert.equal((await send([point(2)])).rows[0].accepted, 1);
    await send([point(1, -5000)]);
    assert.equal(
      (await feed())[0].latitude,
      point(2).latitude,
      "late backfill cannot rewind latest position",
    );
    await assert.rejects(
      send([point(3), { ...point(4), latitude: 91 }]),
      /check constraint/,
    );
    await assert.rejects(
      send([{ ...point(4), accuracyM: -1 }]),
      /check constraint/,
    );
    await assert.rejects(
      send([{ ...point(4), latitude: "NaN" }]),
      /check constraint/,
    );
    await assert.rejects(send([point(5, 120000)]), /outside tracking session/);
    await assert.rejects(send([point(5, -120000)]), /outside tracking session/);
    await assert.rejects(
      send(Array.from({ length: 121 }, (_, i) => point(i + 1))),
      /120 points/,
    );
    await assert.rejects(send({}), /array/);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*) n from public.tracking_points")).rows[0]
        .n,
      2,
      "retry deduplicated and malformed batch rolled back",
    );
    await login(null, "anon");
    assert.equal((await feed()).length, 1);
    await assert.rejects(
      db.query("select * from public.tracking_points"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.tracking_sessions"),
      /permission denied/,
    );
    await assert.rejects(start(), /permission denied/);
    assert.equal("userId" in (await feed())[0], false);
    await db.exec("reset role");
    await db.query("update public.races set status='draft' where id=$1", [
      race,
    ]);
    await login(null, "anon");
    assert.deepEqual(await feed(), []);
    await login(owner);
    await assert.rejects(send([point(5)]), /no longer public/);
    await db.exec("reset role");
    await db.query("update public.races set status='published' where id=$1", [
      race,
    ]);
    await login(owner);
    await db.query("select public.stop_tracking_session($1,now())", [session]);
    assert.deepEqual(
      await feed(),
      [],
      "stop immediately removes public positions",
    );
    await send([point(6, -1000)]);
    assert.deepEqual(
      await feed(),
      [],
      "offline backfill after stop never republishes",
    );
    await assert.rejects(start(), /ended/);
    const second = id();
    await login(editor);
    await start(second);
    await db.query("select public.ingest_tracking_points($1,$2)", [
      second,
      JSON.stringify([{ ...point(1), recordedAt: new Date().toISOString() }]),
    ]);
    assert.equal((await feed()).length, 1);
    await db.exec("reset role");
    await db.query(
      "delete from public.boat_members where boat_id=$1 and user_id=$2",
      [bid, editor],
    );
    await login(null, "anon");
    assert.deepEqual(
      await feed(),
      [],
      "revocation removes public feed without waiting for phone",
    );
    await login(editor);
    await assert.rejects(
      db.query("select public.ingest_tracking_points($1,$2)", [
        second,
        JSON.stringify([point(2)]),
      ]),
      /authorization/,
    );
    await db.query("select public.stop_tracking_session($1,now())", [second]);
    await login(owner);
    const third = id();
    await start(third);
    await db.exec("reset role");
    await db.query(
      "update public.tracking_sessions set started_at=now()-interval '13 hours',expires_at=now()-interval '1 hour' where id=$1",
      [third],
    );
    await login(null, "anon");
    assert.deepEqual(await feed(), []);
    await login(owner);
    await start(id());
  } finally {
    await db.close();
  }
});
