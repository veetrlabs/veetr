-- Independent trips reuse position storage without becoming race sessions.
alter table public.tracking_sessions alter column series_id drop not null;
drop index public.tracking_one_reporter_per_boat;
create unique index tracking_one_reporter_per_boat on public.tracking_sessions(boat_id) where stopped_at is null and series_id is not null;
alter table public.tracking_points add column instruments jsonb;
alter table public.tracking_points add constraint tracking_instruments_object check(instruments is null or jsonb_typeof(instruments)='object');
create table public.trip_shares (
 session_id uuid primary key references public.tracking_sessions(id) on delete cascade,
 token uuid not null unique default gen_random_uuid(),
 title text not null check(length(title) between 1 and 120),
 visibility text not null default 'private' check(visibility in ('private','unlisted','public')),
 live boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.trip_shares enable row level security;
revoke all on public.trip_shares from public,anon,authenticated;
create index trip_shares_public on public.trip_shares(updated_at desc,session_id) where visibility='public';
create index tracking_personal_owner on public.tracking_sessions(user_id,started_at desc) where series_id is null;
create schema if not exists trip_private;
revoke all on schema trip_private from public;
grant usage on schema trip_private to authenticated,anon;

create function trip_private.boats() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_active_account();
 return (select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'color',b.tracking_color) order by b.name,b.id),'[]') from public.boats b
 where b.owner_id=auth.uid() or exists(select 1 from public.boat_members m where m.boat_id=b.id and m.user_id=auth.uid()));
end $$;
create function public.my_trip_boats() returns jsonb language sql security invoker set search_path='' as $$select trip_private.boats()$$;

create function trip_private.write_trip(action text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.tracking_sessions; t public.trip_shares; bid uuid; point jsonb; instr jsonb; k text; n numeric; stamp timestamptz; count_points integer:=0; selected_visibility text;
begin
 perform public.require_active_account();
 if not exists(select 1 from auth.users u where u.id=auth.uid() and to_jsonb(u)->>'email_confirmed_at' is not null) then raise exception 'Verify your email before sharing trips'; end if;
 if action='create' then
  bid:=(payload->>'boatId')::uuid;
  if not exists(select 1 from public.tracking_sessions where id=(payload->>'id')::uuid) and not exists(select 1 from public.boats b where b.id=bid and (b.owner_id=auth.uid() or exists(select 1 from public.boat_members m where m.boat_id=b.id and m.user_id=auth.uid()))) then raise exception 'Boat skipper or crew access required'; end if;
  if (payload->>'startedAt')::timestamptz > now()+interval '30 seconds' or payload->>'startedAt' is null then raise exception 'Invalid trip start'; end if;
  if payload->>'stoppedAt' is not null and ((payload->>'stoppedAt')::timestamptz < (payload->>'startedAt')::timestamptz or (payload->>'stoppedAt')::timestamptz>now()+interval '30 seconds') then raise exception 'Invalid trip end'; end if;
  insert into public.tracking_sessions(id,boat_id,user_id,started_at,expires_at,stopped_at)
  values((payload->>'id')::uuid,bid,auth.uid(),(payload->>'startedAt')::timestamptz,
   greatest((payload->>'startedAt')::timestamptz+interval '12 hours',coalesce((payload->>'stoppedAt')::timestamptz,(payload->>'startedAt')::timestamptz)+interval '1 second'),(payload->>'stoppedAt')::timestamptz)
  on conflict(id) do nothing;
 end if;
 select * into s from public.tracking_sessions where id=(payload->>'id')::uuid for update;
 if not found or s.user_id<>auth.uid() or s.series_id is not null then raise exception 'Trip owner required' using errcode='42501'; end if;
 if action='create' then
  if s.boat_id<>bid then raise exception 'Trip boat cannot be changed after upload'; end if;
  insert into public.trip_shares(session_id,title) values(s.id,coalesce(nullif(btrim(payload->>'title'),''),'My sailing trip')) on conflict(session_id) do nothing;
 end if;
 select * into t from public.trip_shares where session_id=s.id for update;
 if not found then raise exception 'Not a personal trip'; end if;
 if action='ingest' then
  if t.visibility<>'private' and not t.live then raise exception 'Unpublish before changing a finished trip'; end if;
  if jsonb_typeof(payload->'points') is distinct from 'array' or jsonb_array_length(payload->'points')>500 then raise exception 'Invalid point batch'; end if;
  for point in select value from jsonb_array_elements(payload->'points') loop
   stamp:=(point->>'recordedAt')::timestamptz;
   if stamp is null or stamp<s.started_at-interval '1 minute' or stamp>least(s.expires_at,coalesce(s.stopped_at,s.expires_at),now()+interval '30 seconds') then raise exception 'Point outside trip'; end if;
   instr:=point->'instruments';
   if instr='null'::jsonb then instr:=null; end if;
   if instr is not null then
    if jsonb_typeof(instr)<>'object' then raise exception 'Invalid instruments'; end if;
    for k in select jsonb_object_keys(instr) loop
     if k not in ('aws','tws','awa','twa','heading') then raise exception 'Unknown instrument'; end if;
     if instr->k <> 'null'::jsonb then
      if jsonb_typeof(instr->k)<>'number' then raise exception 'Invalid instrument value'; end if;
      n:=(instr->>k)::numeric;
      if (k in ('aws','tws') and (n<0 or n>200)) or (k in ('awa','twa') and abs(n)>180) or (k='heading' and (n<0 or n>=360)) then raise exception 'Instrument out of range'; end if;
     end if;
    end loop;
   end if;
   insert into public.tracking_points(session_id,seq,recorded_at,latitude,longitude,accuracy_m,sog_mps,cog_deg,source,instruments)
   values(s.id,(point->>'seq')::bigint,stamp,(point->>'latitude')::float8,(point->>'longitude')::float8,(point->>'accuracyM')::float8,(point->>'sogMps')::float8,(point->>'cogDeg')::float8,point->>'source',instr)
   on conflict(session_id,seq) do nothing;
   count_points:=count_points+1;
  end loop;
  return to_jsonb(count_points);
 elsif action='publish' then
  selected_visibility:=payload->>'visibility';
  if selected_visibility is null or selected_visibility not in ('private','unlisted','public') then raise exception 'Invalid visibility'; end if;
  if selected_visibility<>'private' and not exists(select 1 from public.tracking_points where session_id=s.id) then raise exception 'Record a position before sharing'; end if;
  if selected_visibility<>'private' and s.stopped_at is null and s.expires_at<=now() then raise exception 'Finish this expired trip before publishing'; end if;
  update public.trip_shares set title=coalesce(nullif(btrim(payload->>'title'),''),title),visibility=selected_visibility,
   live=(selected_visibility<>'private' and s.stopped_at is null),
   token=case when selected_visibility='private' and visibility<>'private' then gen_random_uuid() else token end,updated_at=now() where session_id=s.id;
 elsif action='finish' then
  stamp:=(payload->>'stoppedAt')::timestamptz;
  if stamp is null or stamp<s.started_at or stamp>now()+interval '30 seconds' then raise exception 'Invalid trip end'; end if;
  update public.tracking_sessions set stopped_at=coalesce(stopped_at,least(stamp,expires_at)) where id=s.id;
  -- A retry must not unpublish a finished trip deliberately published later.
  update public.trip_shares set visibility='private',live=false,token=gen_random_uuid(),updated_at=now() where session_id=s.id and live;
 elsif action not in ('create','get') then raise exception 'Unknown trip action';
 end if;
 return (select jsonb_build_object('id',session_id,'token',token,'visibility',visibility,'live',live,'title',title) from public.trip_shares where session_id=s.id);
end $$;
create function public.write_trip(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select trip_private.write_trip(action,payload)$$;

create function trip_private.read_trip(p_token uuid,p_after bigint default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.tracking_sessions; t public.trip_shares; chunk jsonb; last_point jsonb;
begin
 select * into t from public.trip_shares where token=p_token and visibility<>'private';
 if not found then return null; end if;
 select * into s from public.tracking_sessions where id=t.session_id;
 if (t.live and (s.stopped_at is not null or s.expires_at<=now())) or exists(select 1 from public.account_security where user_id=s.user_id and suspended) then return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('seq',seq,'recordedAt',recorded_at,'latitude',latitude,'longitude',longitude,'sogMps',sog_mps,'cogDeg',cog_deg,'instruments',instruments) order by seq),'[]') into chunk
 from (select * from public.tracking_points where session_id=s.id and seq>greatest(0,p_after) order by seq limit 2000) points;
 select jsonb_build_object('recordedAt',recorded_at,'sogMps',sog_mps,'cogDeg',cog_deg,'instruments',instruments) into last_point from public.tracking_points where session_id=s.id order by recorded_at desc,seq desc limit 1;
 return jsonb_build_object('title',t.title,'boat',(select name from public.boats where id=s.boat_id),'color',(select tracking_color from public.boats where id=s.boat_id),'live',t.live,'startedAt',s.started_at,'stoppedAt',s.stopped_at,'latest',last_point,'points',chunk);
end $$;
create function public.shared_trip(p_token uuid,p_after bigint default 0) returns jsonb language sql security invoker set search_path='' as $$select trip_private.read_trip(p_token,p_after)$$;
create function trip_private.directory(p_offset integer default 0) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('token',token,'title',title,'boat',name,'live',live) order by updated_at desc,session_id),'[]') from (
 select t.*,b.name from public.trip_shares t join public.tracking_sessions s on s.id=t.session_id join public.boats b on b.id=s.boat_id
 where t.visibility='public' and (not t.live or (s.stopped_at is null and s.expires_at>now())) and not exists(select 1 from public.account_security where user_id=s.user_id and suspended)
 order by t.updated_at desc,t.session_id limit 50 offset greatest(0,least(p_offset,10000))) rows;
$$;
create function public.public_trips(p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select trip_private.directory(p_offset)$$;
revoke all on all functions in schema trip_private from public,anon,authenticated;
grant execute on function trip_private.boats(),trip_private.write_trip(text,jsonb) to authenticated;
grant execute on function trip_private.read_trip(uuid,bigint),trip_private.directory(integer) to anon,authenticated;
revoke all on function public.my_trip_boats(),public.write_trip(text,jsonb),public.shared_trip(uuid,bigint),public.public_trips(integer) from public,anon,authenticated;
grant execute on function public.my_trip_boats(),public.write_trip(text,jsonb) to authenticated;
grant execute on function public.shared_trip(uuid,bigint),public.public_trips(integer) to anon,authenticated;
-- Existing race controls must neither block on nor take over independent trips.
do $$
declare signature regprocedure; definition text;
begin
 foreach signature in array array[
  'public.start_tracking_session(uuid,uuid,uuid)'::regprocedure,
  'public.take_over_tracking_session(uuid,uuid,uuid,boolean)'::regprocedure,
  'public.arm_race_phone(uuid,text,uuid)'::regprocedure,
  'public.my_tracking_entries()'::regprocedure
 ] loop
  definition:=pg_get_functiondef(signature);
  definition:=replace(definition,'where boat_id=p_boat and stopped_at is null','where boat_id=p_boat and series_id is not null and stopped_at is null');
  definition:=replace(definition,'where boat_id=bid and stopped_at is null','where boat_id=bid and series_id is not null and stopped_at is null');
  definition:=replace(definition,'where ts.boat_id=b.id and ts.stopped_at is null','where ts.boat_id=b.id and ts.series_id is not null and ts.stopped_at is null');
  definition:=replace(definition,'sess.series_id<>p_series','sess.series_id is distinct from p_series');
  execute definition;
 end loop;
end $$;
