import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('draft overrides published heats across public directories, results, and tracking', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role service_role; create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
    const dir = new URL('../migrations/', import.meta.url);
    for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(file, dir), 'utf8'));
    }
    const owner = randomUUID(), stranger = randomUUID();
    await db.query('insert into auth.users(id) values($1),($2)', [owner, stranger]);
    await db.query('insert into public.series_creators values($1)', [owner]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    const doc = JSON.parse(await readFile(new URL('../../veetr.org/imports/orlik-2026/series.json', import.meta.url), 'utf8'));
    doc.status = 'draft';
    await db.query('select public.save_series($1,0,$2)', [doc, randomUUID()]);
    const heat = doc.races.find(r => ['published','locked'].includes(r.status));
    const calls = [
      ['public_standings($1)', [doc.id]],
      ['public_tracking_positions($1)', [doc.id]],
      ['public_regatta_replay($1,now())', [doc.id]],
      ['public_heat_replay($1)', [heat.id]],
      ['public_heat_tracking_times($1)', [heat.id]],
      ['public_race_replay($1,$2)', [doc.id, heat.eventId ?? heat.id]],
      ['public_replay_tracks($1,$2)', [doc.id, heat.eventId ?? heat.id]],
    ];
    for (const role of ['anon', 'authenticated']) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [role === 'anon' ? '' : stranger]);
      await db.exec(`set role ${role}`);
      for (const [query, args] of calls) {
        await assert.rejects(db.query(`select public.${query}`, args), e => e.code === 'PT404', `${role}: ${query}`);
      }
      for (const fn of ['public_series_directory','public_regatta_directory']) {
        assert.deepEqual((await db.query(`select public.${fn}() value`)).rows[0].value, []);
      }
      assert.deepEqual((await db.query('select public.boat_results($1) value', [doc.boats[0].id])).rows[0].value, []);
      assert.deepEqual((await db.query('select public.public_entity_routes() value')).rows[0].value.series, {});
    }
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select document from public.series where id=$1', [doc.id])).rows[0].document.status, 'draft');
    await db.query('select public.public_heat_tracking_times($1)', [heat.id]);
    let revision = 1;
    for (const status of ['active','completed','draft']) {
      doc.status = status;
      await db.query('select public.save_series($1,$2,$3)', [doc, revision++, randomUUID()]);
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub','',false)");
      await db.exec('set role anon');
      if (status === 'draft') {
        await assert.rejects(db.query('select public.public_standings($1)', [doc.id]), e => e.code === 'PT404');
      } else {
        for (const [query, args] of calls) await db.query(`select public.${query}`, args);
        assert.equal((await db.query('select public.public_series_directory() value')).rows[0].value.length, 1);
        assert.equal((await db.query('select public.boat_results($1) value', [doc.boats[0].id])).rows[0].value.length, 1);
      }
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
      await db.exec('set role authenticated');
    }
    const slug = (await db.query('select slug from public.series where id=$1', [doc.id])).rows[0].slug;
    for (const visibility of ['public','unlisted','draft']) {
      doc.visibility = visibility;
      doc.status = visibility === 'draft' ? 'draft' : 'active';
      await db.query('select public.save_series($1,$2,$3)', [doc, revision++, randomUUID()]);
      if (visibility === 'unlisted') {
        const legacy = {...doc}; delete legacy.visibility;
        await db.query('select public.save_series($1,$2,$3)', [legacy, revision++, randomUUID()]);
        assert.equal((await db.query('select document from public.series where id=$1',[doc.id])).rows[0].document.visibility,'unlisted');
      }
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub','',false)");
      await db.exec('set role anon');
      for (const name of ['public_series_directory','public_regatta_directory']) {
        assert.equal((await db.query(`select public.${name}() value`)).rows[0].value.length, visibility === 'public' ? 1 : 0);
      }
      assert.equal((await db.query('select public.boat_results($1) value',[doc.boats[0].id])).rows[0].value.length, visibility === 'public' ? 1 : 0);
      const routes=(await db.query('select public.public_entity_routes() value')).rows[0].value;
      assert.equal(Boolean(routes.series[doc.id]),visibility === 'public');
      for (const route of [slug,doc.id]) {
        if (visibility === 'draft') await assert.rejects(db.query('select public.public_series_by_route($1)',[route]),e=>e.code==='PT404');
        else assert.equal((await db.query('select public.public_series_by_route($1) value',[route])).rows[0].value.visibility,visibility);
      }
      for (const [query,args] of calls) {
        if (visibility === 'draft') await assert.rejects(db.query(`select public.${query}`,args),e=>e.code==='PT404');
        else await db.query(`select public.${query}`,args);
      }
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
      await db.exec('set role authenticated');
    }
    for (const visibility of ['invalid', null]) {
      await assert.rejects(db.query('select public.save_series($1,$2,$3)',[{...doc,visibility},revision,randomUUID()]),e=>e.code==='23514');
    }
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.public_standings($1)', [randomUUID()]), e => e.code === 'PT404');
  } finally { await db.close(); }
});
