import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID as id } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('audit evidence is transactional, attributable, protected and survives deletion', async (t) => {
 const db = new PGlite(); t.after(() => db.close());
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 const dir=new URL('../migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
 const owner=id(), admin=id(), sid=id(), bid=id(), cid=id(), eid=id(), hid=id();
 await db.query('insert into auth.users values($1,$2,now()),($3,$4,now())',[owner,'owner@example.test',admin,'admin@example.test']);
 await db.query('insert into public.platform_admins values($1)',[admin]);
 const login=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
 const logs=async()=>{await db.exec('reset role');return (await db.query('select * from public.audit_log order by id')).rows;};
 const doc={id:sid,name:'Audit regatta',year:2026,status:'active',description:'',categories:[{id:cid,name:'Fleet'}],boats:[{id:bid,name:'Evidence boat',sailNumber:'',className:'',categoryId:cid}],events:[{id:eid,name:'Event',order:1,weight:1,completed:false,discards:[]}],races:[{id:hid,eventId:eid,name:'Heat',date:'2026-09-07',order:1,weight:1,status:'published',entries:[bid],results:[{boatId:bid,status:'FINISHED',position:1}]}]};
 const save=(rev,mutation=id())=>db.query('select public.save_series($1::jsonb,$2,$3)',[JSON.stringify(doc),rev,mutation]);

 await t.test('request, approval and role grant retain the responsible actor',async()=>{
  await login(owner);await db.query('select public.request_creation_access($1)',['Organize our weekly club races']);
  const request=(await db.query('select public.creation_access() a')).rows[0].a.requestId;
  await login(admin);await db.query('select public.review_creation_access($1,true)',[request]);
  const evidence=await logs();
  assert.equal(evidence.find(e=>e.entity_table==='series_access_requests'&&e.action==='insert').actor_id,owner);
  const approval=evidence.find(e=>e.entity_table==='series_access_requests'&&e.action==='update');
  assert.equal(approval.actor_id,admin);assert.equal(approval.actor_email,'admin@example.test');
  assert.equal(approval.old_values.status,'pending');assert.equal(approval.new_values.status,'approved');
  const grant=evidence.find(e=>e.entity_table==='series_creators');
  assert.equal(grant.transaction_id,approval.transaction_id);
 });

 await t.test('series snapshots, results and mutation IDs correlate within a transaction',async()=>{
  const mutation=id();await login(owner);await save(0,mutation);
  const evidence=await logs();
  const created=evidence.find(e=>e.entity_table==='series'&&e.action==='insert');
  assert.equal(created.actor_id,owner);assert.equal(created.database_role,'authenticated');
  assert.equal(created.new_values.document.events[0].name,'Event');
  const result=evidence.find(e=>e.entity_table==='race_results'&&e.action==='insert');
  assert.equal(result.new_values.position,1);assert.equal(result.series_id,sid);
  assert.equal(result.transaction_id,created.transaction_id);
  const ledger=evidence.find(e=>e.entity_table==='series_changes'&&e.action==='insert');
  assert.equal(ledger.entity_key.mutation_id,mutation);assert.equal(ledger.transaction_id,created.transaction_id);
  assert.equal(ledger.new_values.document,undefined);
  const count=evidence.length;await login(owner);await save(0,mutation);assert.equal((await logs()).length,count);
 });

 await t.test('correction retains old and new results; rollback leaves no false evidence',async()=>{
  doc.races[0].results[0]={boatId:bid,status:'DNF'};await login(owner);await save(1);
  const evidence=await logs();const change=evidence.find(e=>e.entity_table==='series'&&e.action==='update');
  assert.equal(change.old_values.document.races[0].results[0].position,1);
  assert.equal(change.new_values.document.races[0].results[0].status,'DNF');
  const count=evidence.length;
  await db.exec("begin; update public.boats set name='Rolled back'; rollback;");
  assert.equal((await logs()).length,count);
  await login(owner);await assert.rejects(save(0),/changed|conflict/i);
  assert.equal((await logs()).length,count);
 });

 await t.test('anonymous, app admin and service roles cannot read or tamper with audit rows',async()=>{
  for(const role of ['anon','authenticated','service_role']){
   await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec(`set role ${role}`);
   for(const sql of ['select * from public.audit_log','delete from public.audit_log',"update public.audit_log set action='forged'",'truncate public.audit_log',"insert into public.audit_log(database_role,action,entity_table,entity_key) values('x','x','x','{}')"]){
    await assert.rejects(db.exec(sql),/permission denied/);
   }
   if(role!=='service_role')await assert.rejects(db.query('select public.audit_request_email($1,$2,$3)',[id(),'attempted',id()]),/permission denied/);
  }
 });

 await t.test('service email logging accepts structured outcomes without message content',async()=>{
  await db.exec('reset role');const request=(await db.query('select id from public.series_access_requests where user_id=$1',[owner])).rows[0].id;
  await db.exec('set role service_role');const attempt=id();
  await db.query('select public.audit_request_email($1,$2,$3,$4)',[request,'accepted',attempt,200]);
  await assert.rejects(db.query('select public.audit_request_email($1,$2,$3)',[request,'arbitrary body',attempt]),/Invalid email outcome/);
  const entry=(await logs()).find(e=>e.action==='email.accepted');
  assert.equal(entry.actor_id,null);assert.equal(entry.database_role,'service_role');
  assert.deepEqual(entry.metadata,{attempt_id:attempt,provider_status:200});
 });

 await t.test('entity and actor deletion preserve names, snapshots and identity',async()=>{
  await login(owner);await db.query('select public.delete_race_entity($1,2)',[sid]);await db.query('select public.delete_boat($1)',[bid]);
  await db.exec('reset role');await db.query('delete from auth.users where id=$1',[owner]);
  const evidence=await logs();const deleted=evidence.find(e=>e.entity_table==='series'&&e.action==='delete');
  assert.equal(deleted.old_values.name,'Audit regatta');assert.equal(deleted.old_values.document.events[0].name,'Event');
  assert.equal(deleted.actor_id,owner);assert.equal(deleted.actor_email,'owner@example.test');
  const boat=evidence.find(e=>e.entity_table==='boats'&&e.action==='delete');assert.equal(boat.old_values.name,'Evidence boat');
  assert.ok(evidence.some(e=>e.entity_table==='race_results'&&e.action==='delete'));
 });
});
