import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('anonymous standings omit absent optional scoring fields and keep explicit values', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role service_role; create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
    const dir = new URL('../migrations/', import.meta.url);
    for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(file, dir), 'utf8'));
    }
    const user = randomUUID();
    await db.query('insert into auth.users(id) values($1)', [user]);
    await db.query('insert into public.series_creators values($1)', [user]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    const doc = JSON.parse(await readFile(new URL('../../veetr.org/imports/orlik-2026/series.json', import.meta.url), 'utf8'));
    delete doc.pointsStart;
    for (const event of doc.events) delete event.countAs;
    await db.query('select public.save_series($1,0,$2)', [doc, randomUUID()]);
    await db.exec('set role anon');
    const pub = (await db.query('select public.public_standings($1) doc', [doc.id])).rows[0].doc;
    assert.equal(Object.hasOwn(pub, 'pointsStart'), false);
    assert.ok(pub.events.every(e => !Object.hasOwn(e, 'countAs')));
    assert.equal(pub.boats.length, 37);
    assert.ok(pub.races.every(r => ['published', 'locked'].includes(r.status)));
    assert.deepEqual(pub.races.map(r => r.results), doc.races.map(r => r.results));
  } finally { await db.close(); }
});
