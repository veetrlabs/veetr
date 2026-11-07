import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('tracking tables accept finite nonnegative speeds without a ceiling', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const dir = new URL('../migrations/', import.meta.url);
  for (const name of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(name, dir), 'utf8'));
  // Exercise the actual migrated constraints, independently of session foreign keys.
  for (const table of ['tracking_points', 'race_phone_points']) {
    const { rows } = await db.query(`select pg_get_constraintdef(oid) as definition from pg_constraint
      where conrelid = $1::regclass and conname = $2`, [`public.${table}`, `${table}_sog_mps_check`]);
    assert.equal(rows.length, 1);
    await db.exec(`create temporary table speed_check (sog_mps double precision ${rows[0].definition})`);
    for (const value of [null, 0, 100, 100.01, 231.120357, 1200]) {
      const result = await db.query('insert into speed_check values ($1) returning sog_mps', [value]);
      assert.equal(result.rows[0].sog_mps, value);
    }
    for (const value of ['-1', 'NaN', 'Infinity', '-Infinity'])
      await assert.rejects(db.query('insert into speed_check values ($1::double precision)', [value]), /check constraint/);
    await db.exec('drop table speed_check');
  }
});
