import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID as id} from 'node:crypto';

test('handover requires explicit verified acceptance and removes only the old custodian’s boat access',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;
   create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz default now());
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const dir=new URL('../migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  const creator=id(),recipient=id(),stranger=id(),manager=id(),admin=id(),boat=id(),series=id();
  for(const [uid,email] of [[creator,'creator'],[recipient,'recipient'],[stranger,'stranger'],[manager,'manager'],[admin,'admin']])await db.query('insert into auth.users values($1,$2,now())',[uid,`${email}@test.example`]);
  await db.query('insert into public.platform_admins values($1)',[admin]);
  await db.query("insert into public.boats(id,owner_id,name,sail_number) values($1,$2,'Shell','')",[boat,creator]);
  await db.query("insert into public.series(id,owner_id,name,year,status,document) values($1,$2,'Series',2026,'active','{}')",[series,creator]);
  await db.query("insert into public.boat_members values($1,$2,'manager'),($1,$3,'manager')",[boat,creator,manager]);
  const login=async(uid,aal='aal1')=>{
   await db.exec('reset role');const session=id();
   await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,uid]);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({aal,session_id:session,iat:Math.floor(Date.now()/1000)})]);
   await db.exec('set role authenticated');
  };
  const rpc=async(name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) data`,args)).rows[0].data;
  await login(creator);
  assert.deepEqual(await rpc('boat_responsibility',[boat]),{claimed:false,canTransfer:true});
  assert.equal((await rpc('boat_team',[boat])).find(m=>m.id===creator).role,'creator');
  const invitation=await rpc('request_boat_handover',[boat,'recipient@test.example']);
  assert.equal(invitation.status,'pending');
  assert.equal((await rpc('boat_invitation_preview',[invitation.token])).handover,true);
  assert.equal((await rpc('prepare_boat_invitation_email',[invitation.id])).handover,true);
  assert.equal((await rpc('boat_team_invitations',[boat]))[0].handover,true);
  await assert.rejects(rpc('request_boat_handover',[boat,'stranger@test.example']),/Wait a minute/);
  await login(recipient);
  assert.equal(await rpc('can_manage_boat',[boat]),false); // verified sign-in alone is insufficient
  await login(stranger);await assert.rejects(rpc('accept_boat_invitation',[invitation.token]),/verified email/);
  await login(manager);await assert.rejects(rpc('request_boat_handover',[boat,'manager@test.example']),/responsible skipper/);
  await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[recipient]);
  await login(recipient);await assert.rejects(rpc('accept_boat_invitation',[invitation.token]),/verified email/);
  await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=now() where id=$1',[recipient]);
  await login(recipient);await rpc('accept_boat_invitation',[invitation.token]);await rpc('accept_boat_invitation',[invitation.token]);
  assert.deepEqual(await rpc('boat_responsibility',[boat]),{claimed:true,canTransfer:true});
  assert.equal((await rpc('boat_team',[boat])).find(m=>m.id===recipient).role,'owner');
  await login(creator);
  assert.equal(await rpc('can_manage_boat',[boat]),false);
  assert.equal(await rpc('is_official',[series]),true);
  await assert.rejects(rpc('request_boat_handover',[boat,'creator@test.example']),/responsible skipper/);
  await db.exec('reset role');
  const row=(await db.query('select owner_id,created_by,responsibility_accepted_at from public.boats where id=$1',[boat])).rows[0];
  assert.equal(row.owner_id,recipient);assert.equal(row.created_by,creator);assert.ok(row.responsibility_accepted_at);
  await login(recipient);
  await db.exec('reset role');await db.query("update public.boat_invitations set created_at=now()-interval '2 minutes' where boat_id=$1",[boat]);
  await login(recipient);
  const expired=await rpc('request_boat_handover',[boat,'stranger@test.example']);
  await db.exec('reset role');await db.query("update public.boat_invitations set expires_at=now()-interval '1 second',created_at=now()-interval '2 minutes' where id=$1",[expired.id]);
  await login(stranger);await assert.rejects(rpc('accept_boat_invitation',[expired.token]),/expired/);
  await login(admin);await assert.rejects(rpc('request_boat_handover',[boat,'manager@test.example']),/responsible skipper/);
  await login(admin,'aal2');const replacement=await rpc('request_boat_handover',[boat,'manager@test.example']);
  await login(stranger);await assert.rejects(rpc('accept_boat_invitation',[expired.token]),/unavailable/);
  await login(admin,'aal2');await rpc('revoke_boat_team_invitation',[replacement.id]);
  await login(manager);await assert.rejects(rpc('accept_boat_invitation',[replacement.token]),/unavailable/);
 } finally {await db.close();}
});
