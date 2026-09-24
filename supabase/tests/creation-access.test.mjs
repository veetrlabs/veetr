import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readdir,readFile} from 'node:fs/promises';
test('creation access is denied by default and only admins can approve requests',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role service_role bypassrls; create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 const dir=new URL('../migrations/',import.meta.url);for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
 const user='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
 await db.query('insert into auth.users values($1,$2,now()),($3,$4,now())',[user,'user@example.test',admin,'admin@example.test']);await db.query('insert into public.platform_admins values($1)',[admin]);
 const login=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec(`select set_config('request.jwt.claims','{"aal":"aal2"}',false);set role authenticated`);};
 await login(user);assert.equal((await db.query('select public.creation_access() a')).rows[0].a.allowed,false);
 await assert.rejects(db.query('insert into public.series_creators values($1)',[user]),/permission denied/);
 const doc={id:'33333333-3333-4333-8333-333333333333',name:'Test',year:2026,status:'draft',categories:[{id:'44444444-4444-4444-8444-444444444444',name:'Fleet'}],boats:[],races:[]};
 const save=()=>db.query('select public.save_series($1::jsonb,0,gen_random_uuid())',[JSON.stringify(doc)]);
 await assert.rejects(save(),/Organizer approval/);
 await db.query('select public.request_creation_access($1)',['Organizing our club regattas']);await assert.rejects(db.query('select public.request_creation_access($1)',['Duplicate request']),/unique/);
 // Fresh databases have no Supabase default table grants. The email backend
 // must still read the request, while clients and direct writes stay blocked.
 await assert.rejects(db.query('select * from public.series_access_requests'),/permission denied/);
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select * from public.series_access_requests'),/permission denied/);
 await db.exec('reset role; set role service_role');
 assert.equal((await db.query('select note from public.series_access_requests where user_id=$1',[user])).rows[0].note,'Organizing our club regattas');
 await assert.rejects(db.query("update public.series_access_requests set status='approved'"),/permission denied/);
 await login(user);
 await assert.rejects(db.query('select public.list_creation_requests()'),/admin/);
 await login(admin);const request=(await db.query('select public.list_creation_requests() r')).rows[0].r[0];
 await login(user);await assert.rejects(db.query('select public.review_creation_access($1,true)',[request.id]),/admin/);
 await login(admin);await db.query('select public.review_creation_access($1,true)',[request.id]);
 await login(user);assert.equal((await db.query('select public.creation_access() a')).rows[0].a.allowed,true);await save();
 await db.exec('reset role');await db.query('delete from public.series_creators where user_id=$1',[user]);await login(user);
 await db.query('select public.save_series($1::jsonb,1,gen_random_uuid())',[JSON.stringify({...doc,name:'Updated existing series'})]);
 }finally{await db.close();}
});
