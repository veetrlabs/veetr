import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID as id } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
test('entity deletion checks permissions and revision, cascades results, preserves shared boats and prevents resurrection', async () => {
 const db=new PGlite();
 try {
 await db.exec(`create role service_role; create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 const dir=new URL('../migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(f,dir),'utf8'));
 const owner=id(), stranger=id(), official=id(), sid=id(), bid=id(), cid=id(), eid=id(), hid=id();
 await db.query('insert into auth.users(id) values($1),($2),($3)',[owner,stranger,official]);
 await db.query('insert into public.series_creators values($1)',[owner]);
 const login=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
 const doc={id:sid,name:'Deletion test',year:2026,status:'active',description:'',categories:[{id:cid,name:'Fleet'}],boats:[{id:bid,name:'Boat',sailNumber:'',className:'',categoryId:cid}],events:[{id:eid,name:'Event',order:1,weight:1,completed:false,discards:[]}],races:[{id:hid,eventId:eid,name:'Heat',date:'2026-09-07',order:1,weight:1,status:'published',entries:[bid],results:[{boatId:bid,status:'FINISHED',position:1}]}]};
 const save=rev=>db.query('select public.save_series($1::jsonb,$2,$3)',[JSON.stringify(doc),rev,id()]);
 await login(owner);await save(0);
 await db.exec('reset role');await db.query("insert into public.race_officials values($1,$2,'official')",[sid,official]);
 await login(stranger);await assert.rejects(db.query('select public.delete_race_entity($1,1)',[sid]),/admin/);
 await login(official);await assert.rejects(db.query('select public.delete_race_entity($1,1,null,$2)',[sid,hid]),/admin/);
 await assert.rejects(db.query('select public.save_series($1::jsonb,1,$2)',[JSON.stringify({...doc,races:[]}),id()]),/manager/);
 await login(owner);await assert.rejects(db.query('select public.delete_race_entity($1,0)',[sid]),/changed/);
 await assert.rejects(db.query('select public.delete_boat($1)',[bid]),/all series/);
 await db.query('select public.delete_race_entity($1,1,null,$2)',[sid,hid]);
 assert.equal((await db.query('select count(*)::int n from public.race_results')).rows[0].n,0);
 assert.equal((await db.query('select document from public.series where id=$1',[sid])).rows[0].document.events.length,1);
 await db.query('select public.delete_race_entity($1,2,$2)',[sid,eid]);
 assert.equal((await db.query('select document from public.series where id=$1',[sid])).rows[0].document.events.length,0);
 await db.query('select public.delete_race_entity($1,3)',[sid]);
 assert.equal((await db.query('select count(*)::int n from public.boats')).rows[0].n,1);
 await assert.rejects(save(0),/deleted/);
 await db.query('select public.delete_boat($1)',[bid]);
 assert.equal((await db.query('select count(*)::int n from public.boats')).rows[0].n,0);
 } finally {await db.close();}
});
