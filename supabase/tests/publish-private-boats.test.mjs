import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID as id} from 'node:crypto';
test('publishing is atomic, owner-only and retry-safe; accepted boats appear without a race',async()=>{
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
  const publish=async(profile,expected=null,id=boat)=>(await db.query('select public.publish_private_boat($1,$2,$3) value',[id,JSON.stringify(profile),expected])).rows[0].value;
  const owned=async()=>(await db.query('select public.my_owned_boats() value')).rows[0].value;
  await login(owner);
  const initial=(await owned())[0];
  const polar={id:'reference',name:'Reference',version:'1',source:'manual',createdAt:'2026-10-13T00:00:00Z',points:[{tws:6,twa:60,speed:4}]};
  const profile={name:'Published',className:'Cruiser',lengthM:9,weightKg:2500,waterlineLengthM:8,draftM:2,polar};
  const saved=await publish(profile,initial.updatedAt);
  assert.equal(saved.name,'Published');assert.deepEqual(saved.polar,polar);assert.equal(saved.weightKg,2500);
  await assert.rejects(publish({...profile,name:'Stale'},initial.updatedAt),/changed elsewhere/);
  for(const bad of [{...profile,trips:[]},{...profile,waterlineLengthM:10},{...profile,polar:{...polar,points:[{tws:6,twa:60,speed:4,sessionId:'private'}]}}])await assert.rejects(publish(bad,saved.updatedAt));
  assert.deepEqual((await owned())[0],saved);
  // Shrinking length and waterline together must pass as one atomic change.
  const smaller=await publish({...profile,lengthM:7,waterlineLengthM:6},saved.updatedAt);
  assert.equal(smaller.lengthM,7);
  await login(crew);await assert.rejects(publish(profile),/belongs to another account/);assert.deepEqual(await owned(),[]);
  await login(manager);await assert.rejects(publish(profile,smaller.updatedAt),/belongs to another account/);
  await login(owner);
  const newId=id();const created=await publish(profile,null,newId);
  assert.equal(created.id,newId);assert.equal((await owned()).length,2);
  assert.deepEqual(await publish({...profile,name:'Retry'},null,newId),created);
  const invite=(await db.query('select public.request_boat_handover($1,$2) value',[newId,`${crew}@test.example`])).rows[0].value;
  await db.exec('reset role;set role anon');
  const preview=(await db.query('select public.boat_invitation_preview($1) value',[invite.token])).rows[0].value;
  assert.equal(preview.boatId,newId);assert.equal(preview.boat,'Published');
  await assert.rejects(publish(profile,null,id()),/permission denied/);
  await login(crew);await db.query('select public.accept_boat_invitation($1)',[invite.token]);
  assert.equal((await owned())[0].id,newId);
  await login(owner);assert.deepEqual((await owned()).map(b=>b.id),[boat]);
  await assert.rejects(publish(profile,created.updatedAt,newId),/belongs to another account/);
  await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[crew]);
  await login(crew);await assert.rejects(publish(profile,null,id()),/Verify your email/);
 } finally {await db.close();}
});
