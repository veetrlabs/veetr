import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID as id} from 'node:crypto';
test('public boat specifications validate curves, preserve edit permissions and reject stale updates',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;
   create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz default now());
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const dir=new URL('../migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const owner=id(),crew=id(),manager=id(),boat=id();
  for(const uid of [owner,crew,manager])await db.query('insert into auth.users values($1,$2,now())',[uid,`${uid}@test.example`]);
  await db.query("insert into public.boats(id,owner_id,name,sail_number,length_m) values($1,$2,'Boat','',10)",[boat,owner]);
  await db.query("insert into public.boat_members values($1,$2,'crew'),($1,$3,'manager')",[boat,crew,manager]);
  const login=async(uid)=>{
   await db.exec('reset role');const session=id();await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,uid]);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({aal:'aal1',session_id:session,iat:Math.floor(Date.now()/1000)})]);
   await db.exec('set role authenticated');
  };
  const read=async()=> (await db.query('select public.boat_specifications($1) value',[boat])).rows[0].value;
  const save=async(details,expected={})=>(await db.query('select public.save_boat_specifications($1,$2,$3) value',[boat,JSON.stringify(details),JSON.stringify(expected)])).rows[0].value;
  const specs={sailNumber:'CZE123',manufacturer:'Builder',model:'Cruiser',variant:'2024',waterlineLengthM:8,draftM:2,airDraftM:14,beamM:3,polar:{id:'p',name:'Reference',version:'1',source:'manual',createdAt:'2026-10-13T00:00:00Z',points:[{tws:6,twa:60,speed:4},{tws:10,twa:60,speed:6}]}};
  await login(owner);assert.deepEqual(await save(specs),specs);
  assert.deepEqual(await read(),specs);
  await assert.rejects(save({...specs,beamM:4}),/changed elsewhere/);
  for(const invalid of [{...specs,draftM:-1},{...specs,waterlineLengthM:11},{...specs,trips:[]},{...specs,polar:{...specs.polar,points:[{tws:8,twa:200,speed:3}]}},{...specs,polar:{...specs.polar,points:[{tws:8,twa:60,speed:3,sessionId:'private'}]}},{...specs,polar:{...specs.polar,points:[specs.polar.points[0],specs.polar.points[0]]}}]) await assert.rejects(save(invalid,specs));
  assert.deepEqual(await read(),specs);
  await login(crew);await assert.rejects(save({},specs),/owner or editor/);
  await login(manager);assert.deepEqual(await save({...specs,beamM:3.2},specs),{...specs,beamM:3.2});
  await db.exec('reset role;set role anon');
  assert.equal((await read()).beamM,3.2);
  await assert.rejects(save({}),/permission denied/);
  await db.exec('reset role');
  assert.equal((await db.query("select jsonb_array_elements(public.boat_directory()) value")).rows[0].value.specifications,undefined);
 } finally {await db.close();}
});
