import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID as id} from 'node:crypto';
test('personal trips: crew selection, private upload, live publication, revocation and finished publication',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 const dir=new URL('../migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
 const owner=id(),crew=id(),other=id(),boat=id(),trip=id(),start=new Date(Date.now()-60000).toISOString();
 for(const uid of [owner,crew,other])await db.query('insert into auth.users values($1,$2,now())',[uid,`${uid}@example.test`]);
 await db.query("insert into public.boats(id,owner_id,name,sail_number) values($1,$2,'Luna','')",[boat,owner]);
 await db.query("insert into public.boat_members values($1,$2,'crew')",[boat,crew]);
 const login=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid??'']);await db.exec(uid?'set role authenticated':'set role anon');};
 const write=async(action,payload={})=>(await db.query('select public.write_trip($1,$2::jsonb) data',[action,JSON.stringify({id:trip,...payload})])).rows[0].data;
 const read=async(token,after=0)=>(await db.query('select public.shared_trip($1,$2) data',[token,after])).rows[0].data;
 await login(crew);
 assert.equal((await db.query('select public.my_trip_boats() data')).rows[0].data.length,1);
 const initial=await write('create',{boatId:boat,startedAt:start,title:'Our sail'});
 assert.equal(initial.visibility,'private');
 await assert.rejects(db.query('select * from public.trip_shares'),/permission denied/);
 await write('ingest',{points:[{seq:1,recordedAt:start,latitude:49,longitude:14,source:'veetr',sogMps:2,cogDeg:100,instruments:{twa:-45,awa:0,aws:12,tws:10,heading:90}}]});
 await assert.rejects(write('ingest',{points:[{seq:2,recordedAt:start,latitude:49,longitude:14,source:'veetr',instruments:{twa:181}}]}),/out of range/);
 await login(null);assert.equal(await read(initial.token),null);
 await assert.rejects(write('get'),/permission denied/);
 await login(other);await assert.rejects(write('get'),/owner required/);await assert.rejects(write('create',{id:id(),boatId:boat,startedAt:start}),/crew access required/);
 await login(owner);await assert.rejects(write('publish',{visibility:'public'}),/owner required/);
 await login(crew);const live=await write('publish',{visibility:'unlisted'});
 await login(null);const visible=await read(live.token);assert.equal(visible.live,true);assert.equal(visible.points[0].instruments.twa,-45);assert.equal(visible.points[0].instruments.awa,0);assert.equal((await read(live.token,1)).points.length,0);
 assert.equal((await db.query('select public.public_trips() data')).rows[0].data.length,0);
 await db.exec('reset role');await db.query('delete from public.boat_members where boat_id=$1 and user_id=$2',[boat,crew]);
  await login(crew);await write('create',{boatId:boat,startedAt:start}); // Revoked crew can still revoke their own trip.
  await write('publish',{visibility:'private'});await login(null);assert.equal(await read(live.token),null);
 await login(crew);const again=await write('publish',{visibility:'public'});assert.notEqual(again.token,live.token);
 await login(null);assert.equal((await db.query('select public.public_trips() data')).rows[0].data.length,1);
 await login(crew);await write('finish',{stoppedAt:new Date().toISOString()});await login(null);assert.equal((await read(again.token)).live,false);
 assert.equal((await db.query('select public.public_trips() data')).rows[0].data.length,1);
 await login(crew);const done=await write('publish',{visibility:'unlisted'});assert.equal(done.token,again.token);await write('finish',{stoppedAt:new Date().toISOString()});
 await assert.rejects(write('ingest',{points:[]}),/Unpublish/);
 await login(null);assert.equal((await read(done.token)).live,false);
 await db.exec('reset role');await db.query('insert into public.account_security(user_id,suspended) values($1,true)',[crew]);await login(null);assert.equal(await read(done.token),null);
 await login(crew);await assert.rejects(write('get'),/Account access denied/);
 }finally{await db.close();}
});
