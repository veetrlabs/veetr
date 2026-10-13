import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID as id} from 'node:crypto';
test('account uploads stay private, update safely across devices and publish only by explicit choice',async()=>{
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
  const upload=async(profile,publish=false,expected_private=null,expected_public=null,id=boat)=>(await db.query('select public.upload_account_boat($1,$2,$3,$4,$5) value',[id,JSON.stringify(profile),publish,expected_private,expected_public])).rows[0].value;
  const list=async()=>(await db.query('select public.my_account_boats() value')).rows[0].value;
  const profile={name:'Private cabin boat',className:'Cruiser',weightKg:2400,lengthM:8,draftM:1.5,catalogId:'test-model',polar:{id:'reference',name:'Reference',version:'1',source:'manual',createdAt:'2026-10-13T00:00:00Z',points:[{tws:6,twa:60,speed:4}]}};
  await login(owner);
  const privateId=id();
  const saved=await upload(profile,false,null,null,privateId);
  assert.equal(saved.publiclyVisible,false);assert.equal(saved.uploadPublic,false);
  assert.equal(saved.catalogId,'test-model');assert.deepEqual(saved.polar,profile.polar);
  assert.equal((await db.query('select jsonb_array_elements(public.boat_directory()) value')).rows.some(r=>r.value.id===privateId),false);
  assert.equal((await db.query('select public.boat_specifications($1) value',[privateId])).rows[0].value,null);
  assert.deepEqual(await upload(profile,false,null,null,privateId),saved);
  const changed=await upload({...profile,weightKg:2500},false,saved.privateUpdatedAt,null,privateId);
  await assert.rejects(upload({...profile,weightKg:2600},false,saved.privateUpdatedAt,null,privateId),/changed elsewhere/);
  await assert.rejects(upload({...profile,trips:[]},false,changed.privateUpdatedAt,null,privateId),/Invalid/);
  await login(crew);assert.equal((await list()).some(b=>b.id===privateId),false);
  assert.equal((await db.query('select * from public.account_boats where boat_id=$1',[privateId])).rows.length,0);
  await assert.rejects(db.query('update public.account_boats set profile=$1 where boat_id=$2',[JSON.stringify(profile),privateId]),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(list(),/permission denied/);
  await assert.rejects(db.query('select * from public.account_boats'),/permission denied/);
  await login(owner);
  const published=await upload({...profile,weightKg:2500},true,changed.privateUpdatedAt,null,privateId);
  assert.equal(published.publiclyVisible,true);assert.equal(published.uploadPublic,true);assert.ok(published.publicUpdatedAt);
  assert.equal((await db.query('select jsonb_array_elements(public.boat_directory()) value')).rows.some(r=>r.value.id===privateId),true);
  const privateAgain=await upload({...profile,name:'Private edit'},false,published.privateUpdatedAt,published.publicUpdatedAt,privateId);
  assert.equal(privateAgain.name,'Private edit');assert.equal(privateAgain.publiclyVisible,true);assert.equal(privateAgain.uploadPublic,false);
  assert.equal((await db.query('select jsonb_array_elements(public.boat_directory()) value')).rows.find(r=>r.value.id===privateId).value.name,profile.name);
  // A tracking/crew account may keep its own private copy but cannot publish into another owner's boat.
  await login(crew);
  await assert.rejects(upload(profile,true,null,published.publicUpdatedAt,privateId),/belongs to another account/);
  assert.equal((await list()).length,0);
  await upload({...profile,name:'My private copy'},false,null,null,privateId);
  assert.equal((await list())[0].name,'My private copy');
  await login(owner);assert.equal((await list()).find(b=>b.id===privateId).name,'Private edit');
 } finally {await db.close();}
});
