-- Tracking is independent of the scoring document/outbox. Never rewrite race results
-- for GPS updates. Raw tracks are private; only consenting, current sessions are public.
create table public.tracking_sessions (
 id uuid primary key,
 series_id uuid not null references public.series on delete cascade,
 boat_id uuid not null references public.boats on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 started_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '12 hours',
 stopped_at timestamptz,
 check(expires_at > started_at)
);
create unique index tracking_one_reporter_per_boat on public.tracking_sessions(boat_id) where stopped_at is null;
create index tracking_series_idx on public.tracking_sessions(series_id, expires_at);
create table public.tracking_points (
 session_id uuid not null references public.tracking_sessions on delete cascade,
 seq bigint not null check(seq between 1 and 1000000000),
 recorded_at timestamptz not null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy_m double precision not null check(accuracy_m between 0 and 100),
 sog_mps double precision check(sog_mps between 0 and 100),
 cog_deg double precision check(cog_deg >= 0 and cog_deg < 360),
 source text not null default 'phone' check(source='phone'),
 received_at timestamptz not null default now(),
 primary key(session_id,seq)
);
create index tracking_latest_idx on public.tracking_points(session_id,recorded_at desc,seq desc);
alter table public.tracking_sessions enable row level security;
alter table public.tracking_points enable row level security;
revoke all on public.tracking_sessions,public.tracking_points from anon,authenticated;

create function public.tracking_entry_visible(p_series uuid,p_boat uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.race_entries e join public.races r on r.id=e.race_id
 where e.series_id=p_series and e.boat_id=p_boat and r.status in ('published','locked'));
$$;
revoke all on function public.tracking_entry_visible(uuid,uuid) from public;

create function public.my_tracking_entries() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('seriesId',s.id,'seriesName',s.name,
 'boatId',b.id,'boatName',b.name) order by s.year desc,s.name,b.name),'[]'::jsonb)
 from public.series_entries e join public.series s on s.id=e.series_id join public.boats b on b.id=e.boat_id
 where public.can_edit_boat(b.id) and public.tracking_entry_visible(s.id,b.id);
$$;

create function public.start_tracking_session(p_id uuid,p_series uuid,p_boat uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sess public.tracking_sessions;
begin
 if auth.uid() is null or not public.can_edit_boat(p_boat) then raise exception 'Boat owner or editor required'; end if;
 if not public.tracking_entry_visible(p_series,p_boat) then raise exception 'Boat must be entered in a published heat'; end if;
 -- Serialize starts across phones, even when there are no existing session rows.
 perform 1 from public.boats where id=p_boat for update;
 select * into sess from public.tracking_sessions where id=p_id;
 if found then
  if sess.user_id<>auth.uid() or sess.series_id<>p_series or sess.boat_id<>p_boat then raise exception 'Session ID already used'; end if;
  if sess.stopped_at is not null or sess.expires_at<=now() then raise exception 'Session has ended'; end if;
 else
  update public.tracking_sessions set stopped_at=expires_at where boat_id=p_boat and stopped_at is null and expires_at<=now();
  if exists(select 1 from public.tracking_sessions where boat_id=p_boat and stopped_at is null) then raise exception 'This boat is already tracking on another session. Stop that session first.'; end if;
  insert into public.tracking_sessions(id,series_id,boat_id,user_id) values(p_id,p_series,p_boat,auth.uid()) returning * into sess;
 end if;
 return jsonb_build_object('id',sess.id,'startedAt',sess.started_at,'expiresAt',sess.expires_at);
end;
$$;

create function public.stop_tracking_session(p_id uuid,p_stopped_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare sess public.tracking_sessions;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into sess from public.tracking_sessions where id=p_id for update;
 if not found then return; end if; -- also handles an unacknowledged failed start
 if sess.user_id<>auth.uid() then raise exception 'Session owner required'; end if;
 if p_stopped_at is null then raise exception 'Stop time required'; end if;
 update public.tracking_sessions set stopped_at=least(coalesce(stopped_at,now()),greatest(started_at,p_stopped_at),expires_at) where id=p_id;
end;
$$;

create function public.ingest_tracking_points(p_session uuid,p_points jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare sess public.tracking_sessions; point jsonb; stamp timestamptz;
begin
 select * into sess from public.tracking_sessions where id=p_session for update;
 if sess.id is null or auth.uid() is null or sess.user_id<>auth.uid() or not public.can_edit_boat(sess.boat_id) then raise exception 'Tracking authorization lost'; end if;
 if not public.tracking_entry_visible(sess.series_id,sess.boat_id) then raise exception 'Tracking entry is no longer public'; end if;
 if now()>sess.expires_at+interval '24 hours' then raise exception 'Upload window expired'; end if;
 if jsonb_typeof(p_points) is distinct from 'array' then raise exception 'Points must be an array'; end if;
 if jsonb_array_length(p_points) not between 1 and 120 then raise exception 'Send 1 to 120 points per batch'; end if;
 for point in select value from jsonb_array_elements(p_points) loop
  if jsonb_typeof(point) is distinct from 'object' or not(point ?& array['seq','recordedAt','latitude','longitude','accuracyM']) then raise exception 'Incomplete point'; end if;
  stamp := (point->>'recordedAt')::timestamptz;
  if stamp is null or stamp<sess.started_at-interval '1 minute' or stamp>now()+interval '30 seconds' or stamp>least(sess.expires_at,coalesce(sess.stopped_at,sess.expires_at)) then raise exception 'Point outside tracking session'; end if;
  -- Validate every retry too; malformed batches roll back as one transaction.
  insert into public.tracking_points(session_id,seq,recorded_at,latitude,longitude,accuracy_m,sog_mps,cog_deg,source)
  values(p_session,(point->>'seq')::bigint,stamp,(point->>'latitude')::double precision,(point->>'longitude')::double precision,
   (point->>'accuracyM')::double precision,(point->>'sogMps')::double precision,(point->>'cogDeg')::double precision,coalesce(point->>'source','phone'))
  on conflict(session_id,seq) do nothing;
 end loop;
 -- Acknowledge the submitted batch, including rows from an earlier successful retry.
 return jsonb_array_length(p_points);
end;
$$;

create function public.public_tracking_positions(p_series uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('boatId',b.id,'boatName',b.name,'recordedAt',p.recorded_at,
 'latitude',p.latitude,'longitude',p.longitude,'accuracyM',p.accuracy_m,'sogMps',p.sog_mps,'cogDeg',p.cog_deg,
 'source',p.source,'trail',coalesce((select jsonb_agg(jsonb_build_array(t.latitude,t.longitude) order by t.recorded_at,t.seq)
 from (select latitude,longitude,recorded_at,seq from public.tracking_points where session_id=sess.id
 and recorded_at>now()-interval '5 minutes' order by recorded_at desc,seq desc limit 60) t),'[]'::jsonb)) order by b.name),'[]'::jsonb)
 from public.tracking_sessions sess join public.boats b on b.id=sess.boat_id
 join lateral(select * from public.tracking_points where session_id=sess.id order by recorded_at desc,seq desc limit 1) p on true
 where sess.series_id=p_series and sess.stopped_at is null and sess.expires_at>now()
 and public.tracking_entry_visible(sess.series_id,sess.boat_id)
 -- Removing a boat editor immediately removes their live feed, including while offline.
 and (b.owner_id=sess.user_id or exists(select 1 from public.boat_members m where m.boat_id=b.id and m.user_id=sess.user_id and m.role='editor'));
$$;
revoke all on function public.my_tracking_entries(),public.start_tracking_session(uuid,uuid,uuid),public.stop_tracking_session(uuid,timestamptz),public.ingest_tracking_points(uuid,jsonb),public.public_tracking_positions(uuid) from public;
grant execute on function public.my_tracking_entries(),public.start_tracking_session(uuid,uuid,uuid),public.stop_tracking_session(uuid,timestamptz),public.ingest_tracking_points(uuid,jsonb) to authenticated;
grant execute on function public.public_tracking_positions(uuid) to anon,authenticated;
