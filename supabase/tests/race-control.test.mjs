import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
test("migration, authorization, publication, locks, validation and conflict safety", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL("../migrations/202609060001_race_control.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../migrations/202609060002_series_team.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../migrations/202609060003_public_directory.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const owner = randomUUID(),
      stranger = randomUUID(),
      official = randomUUID(),
      sid = randomUUID(),
      bid = randomUUID(),
      cid = randomUUID(),
      rid = randomUUID();
    await db.query("insert into auth.users(id) values($1),($2),($3)", [
      owner,
      stranger,
      official,
    ]);
    const login = async (user, role = "authenticated") => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
      await db.exec(`set role ${role}`);
    };
    const s = {
      id: sid,
      name: "Orlík",
      year: 2026,
      description: "test",
      status: "active",
      categories: [{ id: cid, name: "≤ 7 m" }],
      boats: [
        {
          id: bid,
          name: "Mistral",
          sailNumber: "CZE 101",
          skipper: "Private name",
          crewNames: "Private crew",
          className: "",
          categoryId: cid,
        },
      ],
      races: [
        {
          id: rid,
          name: "Race 1",
          date: "2026-09-06",
          order: 1,
          weight: 2,
          status: "draft",
          entries: [bid],
          results: [],
        },
      ],
    };
    const save = (doc, rev, mutation = randomUUID()) =>
      db.query("select public.save_series($1::jsonb,$2,$3) revision", [
        JSON.stringify(doc),
        rev,
        mutation,
      ]);
    await login(owner);
    const mutation = randomUUID();
    assert.equal((await save(s, 0, mutation)).rows[0].revision, 1);
    assert.equal(
      (await save(s, 0, mutation)).rows[0].revision,
      1,
      "retry is idempotent",
    );
    await assert.rejects(save(s, 0), /SYNC_CONFLICT/);
    await assert.rejects(
      db.query("update public.series set name='bypass' where id=$1", [sid]),
      /permission denied/,
    );
    await db.exec("reset role");
    await db.query("update auth.users set email=$1 where id=$2", [
      "official@example.test",
      official,
    ]);
    await login(owner);
    assert.equal(
      (await db.query("select public.series_team($1) team", [sid])).rows[0].team
        .length,
      1,
    );
    await db.query(
      "select public.set_series_member($1,'OFFICIAL@example.test','admin')",
      [sid],
    );
    const team = (await db.query("select public.series_team($1) team", [sid]))
      .rows[0].team;
    assert.equal(team.find((m) => m.id === official).role, "admin");
    await db.query(
      "select public.set_series_member($1,'official@example.test','remove')",
      [sid],
    );
    assert.equal(
      (await db.query("select public.series_team($1) team", [sid])).rows[0].team
        .length,
      1,
    );
    await assert.rejects(
      db.query(
        "select public.set_series_member($1,'missing@example.test','official')",
        [sid],
      ),
      /No account found/,
    );
    await login(stranger);
    assert.equal(
      (await db.query("select * from public.series")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.series_team($1)", [sid]),
      /Series admin/,
    );
    await assert.rejects(
      db.query(
        "select public.set_series_member($1,'official@example.test','admin')",
        [sid],
      ),
      /Series admin/,
    );
    await assert.rejects(save(s, 1), /Not a race official/);
    await assert.rejects(
      db.query("select public.set_race_official($1,$2,'admin')", [
        sid,
        stranger,
      ]),
      /Series admin/,
    );
    await login("", "anon");
    assert.equal(
      (await db.query("select public.public_standings($1) value", [sid]))
        .rows[0].value,
      null,
    );
    await assert.rejects(
      db.query("select * from public.series"),
      /permission denied/,
    );
    await login(owner);
    s.races[0].status = "published";
    await assert.rejects(save(s, 1), /Every entry/);
    s.races[0].results = [{ boatId: bid, status: "FINISHED" }];
    await assert.rejects(save(s, 1), /check constraint/);
    s.races[0].results[0].position = 1;
    await save(s, 1);
    await login("", "anon");
    const pub = (
      await db.query("select public.public_standings($1) value", [sid])
    ).rows[0].value;
    assert.equal(pub.races.length, 1);
    assert.equal(pub.boats[0].skipper, undefined);
    assert.equal(pub.boats[0].crewNames, undefined);
    assert.equal(
      (await db.query("select public.public_series_directory() items")).rows[0]
        .items[0].id,
      sid,
    );
    await login(owner);
    s.races[0].results[0].position = 2;
    await assert.rejects(save(s, 2), /Reopen race/);
    s.races[0].results[0].position = 1;
    s.races[0].status = "locked";
    await save(s, 2);
    await db.query("select public.set_race_official($1,$2,'official')", [
      sid,
      official,
    ]);
    await login(official);
    s.races[0].status = "draft";
    await assert.rejects(save(s, 3), /Only a series admin/);
    await login(owner);
    await save(s, 3);
    s.races[0].results[0].position = 2;
    await assert.rejects(save(s, 4), /Position exceeds/);
    assert.equal(
      (await db.query("select revision from public.series")).rows[0].revision,
      4,
      "invalid save rolls back",
    );
    await login("", "anon");
    assert.equal(
      (await db.query("select public.public_standings($1) value", [sid]))
        .rows[0].value,
      null,
      "reopening removes public results",
    );
    assert.deepEqual(
      (await db.query("select public.public_series_directory() items")).rows[0]
        .items,
      [],
      "draft-only series disappear from discovery",
    );
    await login(owner);
    s.boats[0].publishCrew = true;
    s.boats[0].email = "never-public@example.test";
    s.races[0].results[0].position = 1;
    s.races[0].results[0].privateNote = "not public";
    s.races[0].status = "published";
    await save(s, 4);
    await login("", "anon");
    const shared = (
      await db.query("select public.public_standings($1) value", [sid])
    ).rows[0].value;
    assert.equal(shared.boats[0].skipper, "Private name");
    assert.equal(shared.boats[0].crewNames, "Private crew");
    assert.equal(shared.boats[0].email, undefined);
    assert.equal(shared.races[0].results[0].privateNote, undefined);
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL("../migrations/202609060004_live_results.sql", import.meta.url),
        "utf8",
      ),
    );
    await login(owner);
    s.boats[0].name = "Updated live boat";
    s.races[0].results = [];
    await save(s, 5);
    await login(official);
    s.races[0].results = [{ boatId: bid, status: "FINISHED", position: 1 }];
    await save(s, 6);
    await login("", "anon");
    const live = (
      await db.query("select public.public_standings($1) value", [sid])
    ).rows[0].value;
    assert.equal(live.boats[0].name, "Updated live boat");
    assert.equal(live.races[0].results.length, 1);
    await assert.rejects(save(s, 7), /permission denied/);
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL(
          "../migrations/202609060005_boat_registry.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await login(owner);
    const independentBoat = randomUUID();
    await db.query(
      "select public.create_boat($1,'Independent boat','Micro',null)",
      [independentBoat],
    );
    await login("", "anon");
    const directoryBoats = (
      await db.query("select public.boat_directory() items")
    ).rows[0].items;
    assert.ok(directoryBoats.some((b) => b.id === independentBoat));
    assert.equal(directoryBoats.find((b) => b.id === bid).skipper, undefined);
    assert.equal(directoryBoats.find((b) => b.id === bid).owner_id, undefined);
    assert.equal(
      (await db.query("select public.boat_results($1) items", [bid])).rows[0]
        .items.length,
      1,
    );
    assert.deepEqual(
      (
        await db.query("select public.boat_results($1) items", [
          independentBoat,
        ])
      ).rows[0].items,
      [],
    );
    await assert.rejects(
      db.query("select public.create_boat($1,'Forbidden','',null)", [
        randomUUID(),
      ]),
      /permission denied/,
    );
    await login(official);
    s.boats[0].name = "Stale local name";
    s.boats.push({
      id: independentBoat,
      name: "Independent boat",
      sailNumber: "",
      className: "Micro",
      categoryId: s.categories[0].id,
    });
    await save(s, 7);
    const canonical = (
      await db.query("select document from public.series where id=$1", [sid])
    ).rows[0].document;
    assert.equal(canonical.boats[0].name, "Updated live boat");
    assert.equal(canonical.boats[1].length, undefined);
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL("../migrations/202609060007_edit_boats.sql", import.meta.url),
        "utf8",
      ),
    );
    await login(official);
    assert.equal(
      (await db.query("select public.can_edit_boat($1) allowed", [bid])).rows[0]
        .allowed,
      false,
    );
    const expectedBoat = (
      await db.query("select public.boat_directory() items")
    ).rows[0].items.find((b) => b.id === bid);
    await assert.rejects(
      db.query("select public.update_boat($1,'Edited','Micro',6,$2)", [
        bid,
        expectedBoat,
      ]),
      /owner or series admin/,
    );
    await login(owner);
    await db.query("select public.set_race_official($1,$2,'admin')", [
      sid,
      official,
    ]);
    await login(official);
    assert.equal(
      (await db.query("select public.can_edit_boat($1) allowed", [bid])).rows[0]
        .allowed,
      true,
    );
    await db.query("select public.update_boat($1,'Edited','Micro',6,$2)", [
      bid,
      expectedBoat,
    ]);
    await assert.rejects(
      db.query("select public.update_boat($1,'Stale','Micro',6,$2)", [
        bid,
        expectedBoat,
      ]),
      /changed elsewhere/,
    );
    await login("", "anon");
    const editedPublic = (
      await db.query("select public.public_standings($1) value", [sid])
    ).rows[0].value;
    assert.equal(editedPublic.boats[0].name, "Edited");
    assert.equal(editedPublic.boats[0].length, 6);
    await assert.rejects(
      db.query("select public.update_boat($1,'Forbidden','',null,$2)", [
        bid,
        expectedBoat,
      ]),
      /permission denied/,
    );
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL(
          "../migrations/202609070001_event_scoring.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await login(owner);
    const stored = (
      await db.query(
        "select document,revision from public.series where id=$1",
        [sid],
      )
    ).rows[0];
    const document = stored.document;
    document.events = [
      {
        id: randomUUID(),
        name: "Event",
        order: 1,
        weight: 1,
        completed: false,
        discards: [{ from: 4, discard: 1 }],
        privateNote: "hidden",
      },
    ];
    document.races.forEach((r) => (r.eventId = document.events[0].id));
    document.discards = [{ from: 3, discard: 1 }];
    await save(document, stored.revision);
    document.discards = [{ from: 2, discard: 2 }];
    await assert.rejects(save(document, stored.revision + 1), /discard/);
    await login("", "anon");
    const scoringPublic = (
      await db.query("select public.public_standings($1) value", [sid])
    ).rows[0].value;
    assert.equal(scoringPublic.events[0].privateNote, undefined);
    assert.deepEqual(scoringPublic.events[0].discards, [
      { from: 4, discard: 1 },
    ]);
    assert.equal(scoringPublic.races[0].eventId, document.events[0].id);
  } catch (e) {
    console.error(e.message, e.where, e.query);
    throw e;
  } finally {
    await db.close();
  }
});
