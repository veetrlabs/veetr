import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
test('real season roundtrips source scores, dates, repeat counts and public standings',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 const dir=new URL('../migrations/',import.meta.url);for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
 const uid=randomUUID();await db.query('insert into auth.users(id) values($1)',[uid]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 const doc=JSON.parse(await readFile(new URL('../../veetr.org/imports/orlik-2026/series.json',import.meta.url),'utf8'));
 await db.query('select public.save_series($1,0,$2)',[doc,randomUUID()]);
 const pub=(await db.query('select public.public_standings($1) doc',[doc.id])).rows[0].doc;
 assert.equal(pub.boats.length,37);assert.equal(pub.pointsStart,0);assert.equal(pub.events.find(e=>e.name==='24hodinovka').countAs,2);
 assert.deepEqual(pub.races.map(r=>r.results),doc.races.map(r=>r.results));assert.ok(pub.races.every(r=>r.date===''));
 const slug=(await db.query('select slug from public.series where id=$1',[doc.id])).rows[0].slug;
 assert.equal(slug,'orlicka-serie-2026');
 await db.query('update public.series set name=$1 where id=$2',['Renamed series',doc.id]);
 assert.equal((await db.query('select slug from public.series where id=$1',[doc.id])).rows[0].slug,slug);
 const privateId=randomUUID();
 await db.query("insert into public.series(id,owner_id,name,year,status,document) values($1,$2,'Orlická série 2026',2026,'draft','{}')",[privateId,uid]);
 assert.equal((await db.query('select slug from public.series where id=$1',[privateId])).rows[0].slug,'orlicka-serie-2026-2');
 const boatA=randomUUID(),boatB=randomUUID();
 await db.query("select public.create_boat($1,'Testovací loď','',null)",[boatA]);
 await db.query("select public.create_boat($1,'Testovací loď','',null)",[boatB]);
 await db.query("update public.boats set name='Renamed boat' where id=$1",[boatA]);
 await db.exec('set role anon');
 const routes=(await db.query('select public.public_entity_routes() routes')).rows[0].routes;
 assert.equal(routes.series[doc.id],slug);assert.equal(routes.series[privateId],undefined);
 assert.equal(routes.boats[boatA],'testovaci-lod');assert.equal(routes.boats[boatB],'testovaci-lod-2');
 await db.exec('reset role');
 doc.races[0].results[0].points=-1;await assert.rejects(db.query('select public.save_series($1,1,$2)',[doc,randomUUID()]),/Invalid imported points/);
 }finally{await db.close();}
});
