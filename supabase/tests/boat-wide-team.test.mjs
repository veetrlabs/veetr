import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID as id} from 'node:crypto';

test('boat teams migrate across races without giving officials boat-management access',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;
   create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz default now());
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const dir=new URL('../migrations/',import.meta.url),files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
  const migration='202609230009_boat_wide_team.sql';
  for(const file of files.filter(f=>f<migration))await db.exec(await readFile(new URL(file,dir),'utf8'));
  const owner=id(),skipper=id(),crew=id(),official=id(),newcomer=id(),boat=id(),first=id(),second=id();
  for(const [uid,email] of [[owner,'owner'],[skipper,'skipper'],[crew,'crew'],[official,'official'],[newcomer,'newcomer']])await db.query('insert into auth.users values($1,$2,now())',[uid,`${email}@test.example`]);
  await db.query("insert into public.boats(id,owner_id,name,sail_number) values($1,$2,'Boat','')",[boat,owner]);
  for(const sid of [first,second]) {
   const category=id();
   await db.query("insert into public.series(id,owner_id,name,year,status,document) values($1,$2,'Series',2026,'active','{}')",[sid,official]);
   await db.query("insert into public.race_categories values($1,$2,'All')",[category,sid]);
   await db.query('insert into public.series_entries values($1,$2,$3)',[sid,boat,category]);
  }
  await db.query("insert into public.boat_series_members values($1,$2,$3,'skipper'),($1,$2,$4,'crew'),($5,$2,$3,'crew')",[first,boat,skipper,crew,second]);
  const token=(await db.query("insert into public.boat_invitations(series_id,boat_id,email,created_by) values($1,$2,'newcomer@test.example',$3) returning token",[first,boat,owner])).rows[0].token;
  for(const file of files.filter(f=>f>=migration))await db.exec(await readFile(new URL(file,dir),'utf8'));
  assert.equal((await db.query('select role from public.boat_members where boat_id=$1 and user_id=$2',[boat,skipper])).rows[0].role,'manager');
  assert.equal((await db.query('select role from public.boat_members where boat_id=$1 and user_id=$2',[boat,crew])).rows[0].role,'crew');
  const login=async uid=>{
   await db.exec('reset role');const session=id();
   await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,uid]);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({aal:'aal1',session_id:session,iat:Math.floor(Date.now()/1000)})]);
   await db.exec('set role authenticated');
  };
  await login(skipper);
  assert.equal((await db.query('select public.can_manage_boat($1) allowed',[boat])).rows[0].allowed,true);
  assert.equal((await db.query('select public.my_boats() data')).rows[0].data.length,2);
  await login(crew);
  assert.equal((await db.query('select public.can_manage_boat($1) allowed',[boat])).rows[0].allowed,false);
  assert.equal((await db.query('select public.my_boats() data')).rows[0].data.length,2);
  await login(official);
  await assert.rejects(db.query("select public.invite_boat_skipper($1,$2,'attacker@test.example')",[first,boat]),/manager/);
  await assert.rejects(db.query('select public.revoke_boat_access($1,null,$2,$3)',[first,boat,skipper]),/owner/);
  const recipients=(await db.query('select public.race_invitation_recipients($1,$2) data',[first,boat])).rows[0].data;
  assert.deepEqual(new Set(recipients.map(r=>r.id)),new Set([owner,skipper,crew]));
  await login(newcomer);await db.query('select public.accept_boat_invitation($1)',[token]);
  assert.equal((await db.query('select public.can_manage_boat($1) allowed',[boat])).rows[0].allowed,true);
  await login(owner);await db.query("select public.set_boat_member($1,'skipper@test.example','remove')",[boat]);
  await login(skipper);
  assert.deepEqual((await db.query('select public.my_boats() data')).rows[0].data,[]);
  assert.equal((await db.query('select public.can_manage_boat($1) allowed',[boat])).rows[0].allowed,false);
  // The historical series membership remains but must not restore tracking.
  await db.exec('reset role');
  for(const sid of [first,second])assert.equal((await db.query('select public.can_track_series_boat($1,$2,$3) allowed',[sid,boat,skipper])).rows[0].allowed,false);
 } finally {await db.close();}
});
