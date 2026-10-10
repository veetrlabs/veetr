import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID as id } from "node:crypto";
test("race courses are validated, editable by referees and visible only for published races", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(f, dir), "utf8"));
  const owner = id(),
    referee = id(),
    outsider = id(),
    sid = id(),
    race1 = id(),
    race2 = id();
  await db.query(
    "insert into auth.users values($1,'manager@test.example',now()),($2,'referee@test.example',now()),($3,'other@test.example',now())",
    [owner, referee, outsider],
  );
  await db.query("insert into public.series_creators values($1)", [owner]);
  const login = async (uid, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      uid ?? "",
    ]);
    await db.exec(`set role ${role}`);
  };
  const rpc = async (name, args) =>
    (
      await db.query(
        `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as value`,
        args,
      )
    ).rows[0].value;
  const doc = {
    id: sid,
    name: "Sailing course",
    year: 2026,
    status: "active",
    description: "",
    categories: [{ id: id(), name: "Fleet" }],
    boats: [],
    events: [race1, race2].map((id, i) => ({
      id,
      name: `Race ${i + 1}`,
      order: i + 1,
      weight: 1,
      completed: false,
      discards: [],
    })),
    races: [race1, race2].map((eventId, i) => ({
      id: id(),
      eventId,
      name: `Heat ${i + 1}`,
      date: "2026-10-06",
      order: i + 1,
      weight: 1,
      status: i ? "draft" : "published",
      entries: [],
      results: [],
    })),
  };
  const course = {
    marks: [
      {
        id: id(),
        name: "Windward",
        latitude: 49.6,
        longitude: 14.2,
        rounding: "port",
      },
      {
        id: id(),
        name: "Leeward",
        latitude: 49.59,
        longitude: 14.21,
        rounding: "starboard",
      },
    ],
    startLine: [
      { latitude: 49.58, longitude: 14.2 },
      { latitude: 49.58, longitude: 14.201 },
    ],
    notes: "Two laps",
  };
  await login(owner);
  assert.equal(await rpc("save_series", [doc, 0, id()]), 1);
  await db.exec("reset role");
  await db.query("insert into public.race_officials values($1,$2,'official')", [
    sid,
    referee,
  ]);
  await login(referee);
  doc.courses = {
    [race1]: course,
    [race2]: { marks: [], notes: "Private draft course" },
  };
  assert.equal(await rpc("save_series", [doc, 1, id()]), 2);
  for (const mutate of [
    (d) => (d.name = "Hacked"),
    (d) => (d.events[0].name = "Hacked"),
    (d) => (d.races[0].weight = 2),
  ]) {
    const copy = structuredClone(doc);
    mutate(copy);
    await assert.rejects(
      rpc("save_series", [copy, 2, id()]),
      /Series manager required/,
    );
  }
  for (const mutate of [
    (c) => (c.marks[0].latitude = 91),
    (c) => (c.marks[0].longitude = "14"),
    (c) => (c.marks[0].rounding = "either"),
    (c) => (c.marks[0].name = ""),
    (c) => (c.marks[1].id = c.marks[0].id),
    (c) => c.startLine.pop(),
    (c) => (c.startLine[1] = c.startLine[0]),
    (c) => (c.notes = { secret: "private" }),
    (c) => (c.token = "secret"),
    (c) => (c.marks[0].secret = "private"),
    (c) => (c.startLine[0].secret = "private"),
    (c) => (c.marks = Array.from({ length: 41 }, () => c.marks[0])),
  ]) {
    const copy = structuredClone(doc);
    mutate(copy.courses[race1]);
    await assert.rejects(
      rpc("save_series", [copy, 2, id()]),
      /course|mark|start line|position/i,
    );
  }
  const orphan = structuredClone(doc);
  orphan.courses[id()] = { marks: [] };
  await assert.rejects(rpc("save_series", [orphan, 2, id()]), /existing race/);
  await login(outsider);
  await assert.rejects(rpc("save_series", [doc, 2, id()]), /official/);
  await login(null, "anon");
  await assert.rejects(rpc("save_series", [doc, 2, id()]), /permission denied/);
  const shared = await rpc("public_standings", [sid]);
  assert.deepEqual(shared.courses, { [race1]: course });
  assert.ok(!JSON.stringify(shared).includes("Private draft course"));
  await login(referee);
  doc.courses[race1].marks.reverse();
  assert.equal(await rpc("save_series", [doc, 2, id()]), 3);
  await assert.rejects(rpc("save_series", [doc, 2, id()]), /SYNC_CONFLICT/);
  // Live updates are narrow, permission-checked and conditional on the saved course.
  const expected = structuredClone(doc.courses[race1]);
  const fix = {
    latitude: 49.581,
    longitude: 14.201,
    accuracy: 5,
    timestamp: Date.now(),
  };
  await login(outsider);
  await assert.rejects(
    rpc("update_race_start_position", [sid, race1, expected, fix]),
    /editing access/,
  );
  await login(null, "anon");
  await assert.rejects(
    rpc("update_race_start_position", [sid, race1, expected, fix]),
    /permission denied/,
  );
  await login(referee);
  for (const bad of [
    { ...fix, accuracy: 51 },
    { ...fix, latitude: 91 },
    { ...fix, timestamp: Date.now() - 20000 },
    { ...fix, timestamp: Date.now() + 60000 },
    { ...fix, secret: "x" },
  ]) {
    await assert.rejects(
      rpc("update_race_start_position", [sid, race1, expected, bad]),
      /GPS/i,
    );
  }
  const live = await rpc("update_race_start_position", [
    sid,
    race1,
    expected,
    { ...fix, timestamp: Date.now() },
  ]);
  assert.deepEqual(live.startLine[0], {
    latitude: fix.latitude,
    longitude: fix.longitude,
  });
  assert.deepEqual(live.startLine[1], expected.startLine[1]);
  assert.deepEqual(live.marks, expected.marks);
  assert.equal(live.startLive.accuracyMetres, 5);
  await assert.rejects(
    rpc("update_race_start_position", [sid, race1, expected, fix]),
    /changed elsewhere/,
  );
  await login(null, "anon");
  assert.deepEqual((await rpc("public_standings", [sid])).courses[race1], live);
  await login(referee);
  const frozen = await rpc("update_race_start_position", [
    sid,
    race1,
    live,
    null,
  ]);
  assert.equal(frozen.startLive, undefined);
  assert.deepEqual(frozen.startLine, live.startLine);
  doc.courses[race1] = {
    marks: course.marks,
    startBearing: { origin: fix, degrees: 90 },
  };
  doc.courses[race1].startBearing.origin = { latitude: 49, longitude: 14 };
  for (const mutate of [
    (c) => (c.startBearing.degrees = 360),
    (c) => (c.startBearing.distanceMetres = 0),
    (c) => (c.startBearing.origin.secret = "x"),
    (c) => (c.startLive = { updatedAt: "infinity", accuracyMetres: 5 }),
  ]) {
    const invalid = structuredClone(doc);
    mutate(invalid.courses[race1]);
    await assert.rejects(rpc("save_series", [invalid, 5, id()]), /start/i);
  }
  assert.equal(await rpc("save_series", [doc, 5, id()]), 6);
  const bearing = await rpc("update_race_start_position", [
    sid,
    race1,
    doc.courses[race1],
    { ...fix, timestamp: Date.now() },
  ]);
  assert.equal(bearing.startLine, undefined);
  assert.equal(bearing.startBearing.distanceMetres, undefined);
  assert.equal(bearing.startBearing.degrees, 90);
  assert.deepEqual(bearing.startBearing.origin, {
    latitude: fix.latitude,
    longitude: fix.longitude,
  });
  await login(owner);
  await rpc("delete_race_entity", [sid, 7, race1, null]);
  await db.exec("reset role");
  const saved = (
    await db.query("select document from public.series where id=$1", [sid])
  ).rows[0].document;
  assert.deepEqual(Object.keys(saved.courses), [race2]);
});
