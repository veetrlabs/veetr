-- A race invitation grants tracking only: no account, boat editing or scoring access.
create table public.race_tracking_events (
 id uuid primary key default gen_random_uuid(),
 series_id uuid not null references public.series on delete cascade,
 event_id uuid not null,
 name text not null,
 scheduled_start timestamptz not null,
 ended_at timestamptz,
 expires_at timestamptz not null,
 unique(series_id,event_id),
 check(expires_at>scheduled_start)
);
create table public.race_tracking_windows (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.race_tracking_events on delete cascade,
 opened_at timestamptz not null default now(), closed_at timestamptz
);
create unique index race_tracking_one_window on public.race_tracking_windows(event_id) where closed_at is null;
create table public.race_tracking_links (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.race_tracking_events on delete cascade,
 boat_id uuid not null references public.boats on delete cascade,
 token_hash text not null unique,
 device_hash text,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.race_phone_sessions (
 id uuid primary key,
 link_id uuid not null references public.race_tracking_links on delete cascade,
 ready_at timestamptz not null default now(),
 seen_at timestamptz not null default now(),
 stopped_at timestamptz
);
create unique index race_phone_one_session on public.race_phone_sessions(link_id) where stopped_at is null;
create table public.race_phone_points (
 session_id uuid not null references public.race_phone_sessions on delete cascade,
 seq bigint not null check(seq>=0),
 recorded_at timestamptz not null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy_m double precision check(accuracy_m between 0 and 100),
 sog_mps double precision check(sog_mps between 0 and 100),
 cog_deg double precision check(cog_deg>=0 and cog_deg<360),
 source text not null check(source in ('phone','veetr')),
 primary key(session_id,seq)
);
create index race_phone_points_time on public.race_phone_points(session_id,recorded_at desc);
alter table public.race_tracking_events enable row level security;
alter table public.race_tracking_windows enable row level security;
alter table public.race_tracking_links enable row level security;
alter table public.race_phone_sessions enable row level security;
alter table public.race_phone_points enable row level security;
revoke all on public.race_tracking_events,public.race_tracking_windows,public.race_tracking_links,public.race_phone_sessions,public.race_phone_points from anon,authenticated;

create function public.race_phone_hash(secret text) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(secret,'UTF8')),'hex');
$$;
create function public.race_phone_entry(eid uuid,bid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.race_tracking_events e join public.series s on s.id=e.series_id,
 jsonb_array_elements(s.document->'races') r where e.id=eid and coalesce(r->>'eventId',r->>'id')=e.event_id::text
 and r->>'status' in ('published','locked') and (r->'entries') ? bid::text);
$$;
create function public.race_phone_info(lid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('linkId',l.id,'boatId',b.id,'boatName',b.name,'seriesId',e.series_id,'seriesName',s.name,
 'eventId',e.id,'raceName',e.name,'scheduledStart',e.scheduled_start,'expiresAt',e.expires_at,
 'eligible',public.race_phone_entry(e.id,b.id),'active',exists(select 1 from public.race_tracking_windows w where w.event_id=e.id and w.closed_at is null) and e.expires_at>now(),
 'endedAt',e.ended_at,'valid',l.revoked_at is null and e.ended_at is null and e.expires_at>now())
 from public.race_tracking_links l join public.race_tracking_events e on e.id=l.event_id join public.boats b on b.id=l.boat_id join public.series s on s.id=e.series_id where l.id=lid;
$$;
create function public.configure_race_tracking(sid uuid,eid uuid,starts_at timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare event_name text; result uuid;
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 select item->>'name' into event_name from public.series s,jsonb_array_elements(coalesce(s.document->'events',s.document->'races')) item where s.id=sid and item->>'id'=eid::text;
 if event_name is null then raise exception 'Race not found'; end if;
 if starts_at is null or starts_at<now()-interval '1 day' or starts_at>now()+interval '90 days' then raise exception 'Choose a start within the next 90 days'; end if;
 insert into public.race_tracking_events(series_id,event_id,name,scheduled_start,expires_at) values(sid,eid,event_name,starts_at,starts_at+interval '18 hours')
 on conflict(series_id,event_id) do update set name=excluded.name,scheduled_start=excluded.scheduled_start,expires_at=excluded.expires_at returning id into result;
 return result;
end; $$;
create function public.create_race_tracking_link(eid uuid,bid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; secret text; lid uuid;
begin
 select series_id into sid from public.race_tracking_events where id=eid and expires_at>now();
 if sid is null or not public.is_official(sid) then raise exception 'Race official required'; end if;
 if not exists(select 1 from public.series_entries where series_id=sid and boat_id=bid) then raise exception 'Boat is not in this series'; end if;
 perform 1 from public.boats where id=bid for update;
 update public.race_tracking_links set revoked_at=now() where event_id=eid and boat_id=bid and revoked_at is null;
 secret=gen_random_uuid()::text||gen_random_uuid()::text;
 insert into public.race_tracking_links(event_id,boat_id,token_hash) values(eid,bid,public.race_phone_hash(secret)) returning id into lid;
 return jsonb_build_object('id',lid,'token',secret);
end; $$;
create function public.revoke_race_tracking_link(lid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.race_tracking_links l join public.race_tracking_events e on e.id=l.event_id where l.id=lid and public.is_official(e.series_id)) then raise exception 'Race official required'; end if;
 update public.race_tracking_links set revoked_at=now() where id=lid;
end; $$;
create function public.preview_race_tracking_link(token text) returns jsonb language sql stable security definer set search_path='' as $$
 select public.race_phone_info(id) from public.race_tracking_links where token_hash=public.race_phone_hash(token) and revoked_at is null;
$$;
create function public.claim_race_tracking_link(token text,device_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.race_tracking_links;
begin
 if device_secret is null or length(device_secret)<64 or length(device_secret)>200 then raise exception 'Invalid phone credential'; end if;
 select * into l from public.race_tracking_links where token_hash=public.race_phone_hash(token) for update;
 if l.id is null or l.revoked_at is not null or not (public.race_phone_info(l.id)->>'valid')::boolean then raise exception 'Invitation expired or revoked'; end if;
 if l.device_hash is not null and l.device_hash<>public.race_phone_hash(device_secret) then raise exception 'This invitation is already connected to another phone. Ask the referee for a new link.'; end if;
 update public.race_tracking_links set device_hash=public.race_phone_hash(device_secret) where id=l.id;
 return public.race_phone_info(l.id);
end; $$;
create function public.check_race_phone(lid uuid,device_secret text) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.race_tracking_links where id=lid and device_hash=public.race_phone_hash(device_secret)) then raise exception 'Invalid phone credential'; end if;
end; $$;
create function public.race_phone_status(lid uuid,device_secret text,session_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare info jsonb;
begin
 perform public.check_race_phone(lid,device_secret);
 info=public.race_phone_info(lid);
 if session_id is not null then
 update public.race_phone_sessions set seen_at=now() where id=session_id and link_id=lid and stopped_at is null;
 info=info||jsonb_build_object('ready',exists(select 1 from public.race_phone_sessions where id=session_id and link_id=lid and stopped_at is null));
 end if;
 return info;
end; $$;
create function public.arm_race_phone(lid uuid,device_secret text,p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare info jsonb; bid uuid;
begin
 perform public.check_race_phone(lid,device_secret);
 info=public.race_phone_info(lid);
 if not (info->>'valid')::boolean then raise exception 'Invitation expired or revoked'; end if;
 if (info->>'scheduledStart')::timestamptz>now()+interval '12 hours' then raise exception 'You can get ready from 12 hours before the scheduled start'; end if;
 bid=(info->>'boatId')::uuid;
 perform 1 from public.boats where id=bid for update;
 if exists(select 1 from public.tracking_sessions where boat_id=bid and stopped_at is null and expires_at>now()) or exists(
 select 1 from public.race_phone_sessions ps join public.race_tracking_links l on l.id=ps.link_id join public.race_tracking_events e on e.id=l.event_id
 where l.boat_id=bid and ps.id<>p_session and ps.stopped_at is null and l.revoked_at is null and e.expires_at>now()) then raise exception 'Another phone is ready or tracking this boat. Stop it or ask the referee to replace its link.'; end if;
 if exists(select 1 from public.race_phone_sessions where id=p_session and (link_id<>lid or stopped_at is not null)) then raise exception 'Session already ended or belongs to another phone'; end if;
 insert into public.race_phone_sessions(id,link_id) values(p_session,lid) on conflict(id) do nothing;
 return info||jsonb_build_object('startedAt',(select ready_at from public.race_phone_sessions where id=p_session),'ready',true);
end; $$;
create function public.stop_race_phone(lid uuid,device_secret text,p_session uuid,stopped_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.check_race_phone(lid,device_secret);
 update public.race_phone_sessions s set stopped_at=least(coalesce(s.stopped_at,now()),greatest(s.ready_at,coalesce(stop_race_phone.stopped_at,now()))) where s.id=p_session and s.link_id=lid;
end; $$;
create function public.set_race_tracking_active(eid uuid,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare e public.race_tracking_events;
begin
 select * into e from public.race_tracking_events where id=eid for update;
 if e.id is null or not public.is_official(e.series_id) then raise exception 'Race official required'; end if;
 if enabled then
 if e.ended_at is not null or e.expires_at<=now() then raise exception 'Race tracking has ended'; end if;
 if not exists(select 1 from public.series s,jsonb_array_elements(s.document->'races') r where s.id=e.series_id and coalesce(r->>'eventId',r->>'id')=e.event_id::text and r->>'status' in ('published','locked')) then raise exception 'Publish at least one heat before starting tracking'; end if;
 insert into public.race_tracking_windows(event_id) values(eid) on conflict(event_id) where closed_at is null do nothing;
 else update public.race_tracking_windows set closed_at=now() where event_id=eid and closed_at is null;
 end if;
end; $$;
create function public.race_tracking_roster(sid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'eventId',e.event_id,'name',e.name,'scheduledStart',e.scheduled_start,'expiresAt',e.expires_at,
 'endedAt',e.ended_at,'active',exists(select 1 from public.race_tracking_windows w where w.event_id=e.id and w.closed_at is null) and e.expires_at>now(),
 'phones',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'boatId',l.boat_id,'connected',l.device_hash is not null,
 'ready',ps.id is not null,'lastSeen',ps.seen_at,'eligible',public.race_phone_entry(e.id,l.boat_id))) from public.race_tracking_links l
 left join public.race_phone_sessions ps on ps.link_id=l.id and ps.stopped_at is null where l.event_id=e.id and l.revoked_at is null),'[]'::jsonb))) from public.race_tracking_events e where e.series_id=sid),'[]'::jsonb);
end; $$;
create function public.ingest_race_phone_points(lid uuid,device_secret text,p_session uuid,p_points jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare s public.race_phone_sessions; info jsonb; p jsonb; stamp timestamptz;
begin
 perform public.check_race_phone(lid,device_secret);
 select * into s from public.race_phone_sessions where id=p_session and link_id=lid for update;
 if s.id is null then raise exception 'Phone is not ready'; end if;
 info=public.race_phone_info(lid);
 if jsonb_typeof(p_points) is distinct from 'array' or jsonb_array_length(p_points) not between 1 and 120 then raise exception 'Invalid batch'; end if;
 -- Discard pre-start, paused, expired and revoked data rather than exposing it later.
 for p in select value from jsonb_array_elements(p_points) loop
 stamp=(p->>'recordedAt')::timestamptz;
 if exists(select 1 from public.race_tracking_links where id=lid and revoked_at is null) and now()<(info->>'expiresAt')::timestamptz+interval '24 hours' and (info->>'eligible')::boolean and stamp>=s.ready_at and stamp<=least(now()+interval '30 seconds',coalesce(s.stopped_at,now()+interval '30 seconds'),(info->>'expiresAt')::timestamptz,coalesce((info->>'endedAt')::timestamptz,now()+interval '30 seconds'))
 and exists(select 1 from public.race_tracking_windows w where w.event_id=(info->>'eventId')::uuid and stamp>=w.opened_at and stamp<=coalesce(w.closed_at,now()+interval '30 seconds')) then
 insert into public.race_phone_points values(p_session,(p->>'seq')::bigint,stamp,(p->>'latitude')::double precision,(p->>'longitude')::double precision,(p->>'accuracyM')::double precision,(p->>'sogMps')::double precision,(p->>'cogDeg')::double precision,coalesce(p->>'source','phone')) on conflict do nothing;
 end if;
 end loop;
 return jsonb_array_length(p_points);
end; $$;

-- Keep legacy authenticated tracking working; merge guest feeds into the same maps.
alter function public.public_tracking_positions(uuid) rename to account_tracking_positions;
alter function public.public_regatta_replay(uuid,timestamptz) rename to account_regatta_replay;
revoke all on function public.account_tracking_positions(uuid),public.account_regatta_replay(uuid,timestamptz) from public,anon,authenticated;
create function public.race_phone_positions(sid uuid,at_time timestamptz default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x.data),'[]'::jsonb) from (
 select distinct on(l.boat_id) jsonb_build_object('boatId',b.id,'boatName',b.name,'recordedAt',p.recorded_at,'latitude',p.latitude,'longitude',p.longitude,'accuracyM',p.accuracy_m,'sogMps',p.sog_mps,'cogDeg',p.cog_deg,'source',p.source,
 'trail',coalesce((select jsonb_agg(jsonb_build_array(t.latitude,t.longitude) order by t.recorded_at) from public.race_phone_points t where t.session_id=ps.id and t.recorded_at between coalesce(at_time,now())-interval '5 minutes' and coalesce(at_time,now())),'[]'::jsonb)) data
 from public.race_phone_sessions ps join public.race_tracking_links l on l.id=ps.link_id join public.race_tracking_events e on e.id=l.event_id join public.boats b on b.id=l.boat_id
 join lateral(select * from public.race_phone_points p where p.session_id=ps.id and p.recorded_at<=coalesce(at_time,now()) order by recorded_at desc limit 1) p on true
 where e.series_id=sid and l.revoked_at is null and public.race_phone_entry(e.id,l.boat_id)
 and ((at_time is null and ps.stopped_at is null and e.expires_at>now() and exists(select 1 from public.race_tracking_windows w where w.event_id=e.id and w.closed_at is null and p.recorded_at>=w.opened_at))
 or (at_time is not null and at_time<=now() and at_time between ps.ready_at and least(e.expires_at,coalesce(ps.stopped_at,e.expires_at)) and exists(select 1 from public.race_tracking_windows w where w.event_id=e.id and at_time between w.opened_at and coalesce(w.closed_at,e.expires_at))))
 order by l.boat_id,p.recorded_at desc) x;
$$;
create function public.public_tracking_positions(p_series uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select public.account_tracking_positions(p_series)||public.race_phone_positions(p_series);
$$;
create function public.public_regatta_replay(p_series uuid,p_at timestamptz) returns jsonb language sql stable security definer set search_path='' as $$
 select public.account_regatta_replay(p_series,p_at)||public.race_phone_positions(p_series,p_at);
$$;
-- Do not filter out connected account boats merely because the referee has not opened tracking.
create or replace function public.my_tracking_entries() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('seriesId',s.id,'seriesName',s.name,'boatId',b.id,'boatName',b.name,
 'open',public.series_tracking_open(s.id),'eligible',public.tracking_entry_visible(s.id,b.id),
 'tracking',exists(select 1 from public.tracking_sessions ts where ts.boat_id=b.id and ts.stopped_at is null and ts.expires_at>now())) order by s.year desc,s.name,b.name),'[]'::jsonb)
 from public.series_entries e join public.series s on s.id=e.series_id join public.boats b on b.id=e.boat_id where public.can_track_series_boat(s.id,b.id,auth.uid());
$$;
-- Explicit grants: internal helpers and all credential tables stay inaccessible.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('race_phone_hash','race_phone_entry','race_phone_info','configure_race_tracking','create_race_tracking_link','revoke_race_tracking_link','preview_race_tracking_link','claim_race_tracking_link','check_race_phone','race_phone_status','arm_race_phone','stop_race_phone','set_race_tracking_active','race_tracking_roster','ingest_race_phone_points','race_phone_positions','public_tracking_positions','public_regatta_replay') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if f.proname in ('configure_race_tracking','create_race_tracking_link','revoke_race_tracking_link','set_race_tracking_active','race_tracking_roster') then execute format('grant execute on function %s to authenticated',f.signature); end if;
 if f.proname in ('preview_race_tracking_link','claim_race_tracking_link','race_phone_status','arm_race_phone','stop_race_phone','ingest_race_phone_points','public_tracking_positions','public_regatta_replay') then execute format('grant execute on function %s to anon,authenticated',f.signature); end if;
 end loop;
end; $$;

create function public.my_ready_races() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('eventId',e.id,'raceName',e.name,'scheduledStart',e.scheduled_start,'expiresAt',e.expires_at,'boatId',b.id,'boatName',b.name,'eligible',public.race_phone_entry(e.id,b.id)) order by e.scheduled_start,b.name),'[]'::jsonb)
 from public.race_tracking_events e join public.series_entries se on se.series_id=e.series_id join public.boats b on b.id=se.boat_id
 where e.ended_at is null and e.expires_at>now() and public.can_track_series_boat(e.series_id,b.id,auth.uid());
$$;
create function public.connect_my_race_phone(eid uuid,bid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare secret text; sid uuid;
begin
 select series_id into sid from public.race_tracking_events where id=eid and expires_at>now();
 if not public.can_track_series_boat(sid,bid,auth.uid()) then raise exception 'Boat access required'; end if;
 secret=gen_random_uuid()::text||gen_random_uuid()::text;
 insert into public.race_tracking_links(event_id,boat_id,token_hash) values(eid,bid,public.race_phone_hash(secret));
 return jsonb_build_object('token',secret);
end; $$;
revoke all on function public.my_ready_races(), public.connect_my_race_phone(uuid,uuid) from public,anon,authenticated;
grant execute on function public.my_ready_races(), public.connect_my_race_phone(uuid,uuid) to authenticated;

-- The old authenticated start must not take a boat already reserved by a ready phone.
create function public.guard_race_phone_boat() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.boats where id=new.boat_id for update;
 if exists(select 1 from public.race_phone_sessions ps join public.race_tracking_links l on l.id=ps.link_id join public.race_tracking_events e on e.id=l.event_id
 where l.boat_id=new.boat_id and l.revoked_at is null and e.expires_at>now() and ps.stopped_at is null) then raise exception 'A race phone is ready for this boat. Stop that phone or revoke its link first.'; end if;
 return new;
end; $$;
revoke all on function public.guard_race_phone_boat() from public,anon,authenticated;
create trigger guard_race_phone_boat before insert on public.tracking_sessions for each row execute function public.guard_race_phone_boat();

alter function public.public_regatta_directory() rename to account_regatta_directory;
revoke all on function public.account_regatta_directory() from public,anon,authenticated;
create function public.public_regatta_directory() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(d||jsonb_build_object('replayStart',least(nullif(d->>'replayStart','')::timestamptz,b.first_point),'replayEnd',greatest(nullif(d->>'replayEnd','')::timestamptz,b.last_point))),'[]'::jsonb)
 from jsonb_array_elements(public.account_regatta_directory()) d
 left join lateral(select min(p.recorded_at) first_point,max(p.recorded_at) last_point from public.race_phone_points p
 join public.race_phone_sessions ps on ps.id=p.session_id join public.race_tracking_links l on l.id=ps.link_id join public.race_tracking_events e on e.id=l.event_id
 where e.series_id=(d->>'id')::uuid and l.revoked_at is null and public.race_phone_entry(e.id,l.boat_id)) b on true;
$$;
revoke all on function public.public_regatta_directory() from public;
grant execute on function public.public_regatta_directory() to anon,authenticated;

create function public.finish_race_tracking(eid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.race_tracking_events where id=eid and public.is_official(series_id)) then raise exception 'Race official required'; end if;
 update public.race_tracking_events set ended_at=coalesce(ended_at,now()) where id=eid;
 update public.race_tracking_windows set closed_at=now() where event_id=eid and closed_at is null;
 update public.race_phone_sessions set stopped_at=now() where stopped_at is null and link_id in(select id from public.race_tracking_links where event_id=eid);
end; $$;
revoke all on function public.finish_race_tracking(uuid) from public,anon,authenticated;
grant execute on function public.finish_race_tracking(uuid) to authenticated;
