import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
test("catalog migration supports bounded public lookup and atomic admin publication", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../migrations/20261012194734_boat_catalog.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const run = crypto.randomUUID(),
      revision = "a".repeat(40),
      points = Array.from({ length: 16 }, (_, i) => ({
        tws: 6,
        twa: i * 10,
        speed: 5,
      }));
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      model_key: "j24",
      model: "J/24",
      manufacturer: "J Boats",
      configuration: `NOR/${i}`,
      length_m: 7.32,
      draft_m: 1.22,
      beam_m: 2.71,
      points,
    }));
    await db.exec("set role service_role");
    for (let i = 0; i < rows.length; i += 100)
      await db.query("select public.stage_boat_catalog($1,$2)", [
        run,
        JSON.stringify(rows.slice(i, i + 100)),
      ]);
    assert.equal(
      (await db.query("select count(*)::integer n from public.boat_catalog"))
        .rows[0].n,
      0,
    );
    const install = (id) =>
      db.query("select public.install_boat_catalog($1,$2,2024,$3,$4) n", [
        id,
        revision,
        "https://source",
        "b".repeat(64),
      ]);
    assert.equal((await install(run)).rows[0].n, 1000);
    await db.exec("reset role;set role anon");
    assert.equal(
      (await db.query("select * from public.search_boat_catalog('J24')"))
        .rows[0].model,
      "J/24",
    );
    assert.equal(
      (await db.query("select * from public.search_boat_catalog('%')")).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.boat_catalog_configurations('j24',0)",
        )
      ).rows.length,
      30,
    );
    assert.equal(
      (await db.query("select public.boat_catalog_detail('0','wrong') d"))
        .rows[0].d,
      null,
    );
    for (const sql of [
      "delete from public.boat_catalog where id='0'",
      "select * from public.boat_catalog_staging",
    ])
      await assert.rejects(db.query(sql), /permission denied/);
    await assert.rejects(install(crypto.randomUUID()), /permission denied/);
    await db.exec("reset role;set role service_role");
    await assert.rejects(install(crypto.randomUUID()), /Incomplete/);
    const badRun = crypto.randomUUID();
    rows[999].draft_m = -1;
    for (let i = 0; i < rows.length; i += 100)
      await db.query("select public.stage_boat_catalog($1,$2)", [
        badRun,
        JSON.stringify(rows.slice(i, i + 100)),
      ]);
    await assert.rejects(install(badRun), /check constraint/);
    assert.equal(
      (await db.query("select count(*)::integer n from public.boat_catalog"))
        .rows[0].n,
      1000,
    );
    assert.equal(
      (await db.query("select draft_m from public.boat_catalog where id='999'"))
        .rows[0].draft_m,
      1.22,
    );
  } finally {
    await db.close();
  }
});
