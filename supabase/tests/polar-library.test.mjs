import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
test("polar snapshots are private, immutable and respect account suspension", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
    const dir = new URL("../migrations/", import.meta.url);
    for (const file of (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(file, dir), "utf8"));
    const owner = randomUUID(),
      other = randomUUID(),
      polar = randomUUID();
    await db.query("insert into auth.users(id) values($1),($2)", [
      owner,
      other,
    ]);
    const login = async (uid) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        uid,
      ]);
      await db.exec("set role authenticated");
    };
    await login(owner);
    await db.query(
      "insert into public.polar_library(user_id,polar_id,boat_id,document) values($1,$2,'private-boat','{}')",
      [owner, polar],
    );
    assert.equal(
      (await db.query("select * from public.polar_library")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("update public.polar_library set document='{\"changed\":true}'"),
      /permission denied/,
    );
    await login(other);
    assert.equal(
      (await db.query("select * from public.polar_library")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into public.polar_library(user_id,polar_id,boat_id,document,created_at) values($1,$2,'boat','{}',now())",
        [owner, randomUUID()],
      ),
      /row-level security/,
    );
    await db.query("delete from public.polar_library where polar_id=$1", [
      polar,
    ]);
    await login(owner);
    assert.equal(
      (await db.query("select * from public.polar_library")).rows.length,
      1,
    );
    await db.exec("reset role");
    await db.query(
      "insert into public.account_security(user_id,suspended) values($1,true)",
      [owner],
    );
    await login(owner);
    assert.equal(
      (await db.query("select * from public.polar_library")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into public.polar_library(user_id,polar_id,boat_id,document,created_at) values($1,$2,'boat','{}',now())",
        [owner, randomUUID()],
      ),
      /row-level security/,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(
      db.query("select * from public.polar_library"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
