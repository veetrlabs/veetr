-- Heat-scoped historical positions. Raw GPS tables remain private.
create or replace function public.heat_replay_points(p_heat uuid)
returns table(boat_id uuid, boat_name text, session_id uuid, recorded_at timestamptz,
 latitude double precision, longitude double precision, accuracy_m double precision,
 sog_mps double precision, cog_deg double precision, source text)
language sql stable security definer set search_path='' as $$
 with heat as (
 select r.*, coalesce(h->>'eventId',h->>'id') event_id
 from public.races r join public.series s on s.id=r.series_id,
 jsonb_array_elements(s.document->'races') h
 where r.id=p_heat and h->>'id'=r.id::text and r.status in ('published','locked')
 and h->>'status' in ('published','locked')
 )
 select b.id,b.name,ps.id,date_trunc('milliseconds',p.recorded_at),p.latitude,p.longitude,p.accuracy_m,p.sog_mps,p.cog_deg,p.source
 from heat h join public.race_entries re on re.race_id=h.id
 join public.boats b on b.id=re.boat_id
 join public.race_tracking_events e on e.series_id=h.series_id and e.event_id::text=h.event_id
 join public.race_tracking_links l on l.event_id=e.id and l.boat_id=b.id and l.revoked_at is null
 join public.race_phone_sessions ps on ps.link_id=l.id
 join public.race_phone_points p on p.session_id=ps.id
 where p.recorded_at between ps.ready_at and least(now(),e.expires_at,coalesce(ps.stopped_at,e.expires_at))
 and exists(select 1 from public.race_tracking_windows w where w.event_id=e.id
 and p.recorded_at between w.opened_at and coalesce(w.closed_at,e.expires_at))
 union all
 select b.id,b.name,sess.id,date_trunc('milliseconds',p.recorded_at),p.latitude,p.longitude,p.accuracy_m,p.sog_mps,p.cog_deg,p.source
 from heat h join public.race_entries re on re.race_id=h.id
 join public.boats b on b.id=re.boat_id
 join public.tracking_sessions sess on sess.series_id=h.series_id and sess.boat_id=b.id and sess.replay_enabled
 join public.tracking_points p on p.session_id=sess.id
 where p.recorded_at between sess.started_at and least(now(),sess.expires_at,coalesce(sess.stopped_at,sess.expires_at))
 -- Legacy sessions have no event ID: only include the selected heat's UTC date.
 and (p.recorded_at at time zone 'UTC')::date=h.race_date
 and public.can_track_series_boat(sess.series_id,b.id,sess.user_id);
$$;
revoke all on function public.heat_replay_points(uuid) from public,anon,authenticated;

create or replace function public.public_heat_replay(p_heat uuid,p_at timestamptz default null) returns jsonb
language sql stable security definer set search_path='' as $$
 with points as materialized(select * from public.heat_replay_points(p_heat)),
 bounds as(select min(recorded_at) first_point,max(recorded_at) last_point from points),
 frame as(select coalesce(p_at,first_point) stamp from bounds),
 latest as(select distinct on(boat_id) p.* from points p,frame f
 where p.recorded_at<=f.stamp and p.recorded_at>=f.stamp-interval '5 minutes'
 order by boat_id,recorded_at desc,session_id),
 positions as(select jsonb_build_object('boatId',p.boat_id,'boatName',p.boat_name,'recordedAt',p.recorded_at,
 'latitude',p.latitude,'longitude',p.longitude,'accuracyM',p.accuracy_m,'sogMps',p.sog_mps,'cogDeg',p.cog_deg,'source',p.source,
 'trail',(select coalesce(jsonb_agg(jsonb_build_array(t.latitude,t.longitude) order by t.recorded_at),'[]'::jsonb)
 from (select q.* from points q,frame f where q.session_id=p.session_id
 and q.recorded_at between f.stamp-interval '5 minutes' and f.stamp order by q.recorded_at desc limit 60) t)) data
 from latest p)
 select jsonb_build_object('start',first_point,'end',last_point,'positions',
 coalesce((select jsonb_agg(data) from positions),'[]'::jsonb)) from bounds;
$$;
revoke all on function public.public_heat_replay(uuid,timestamptz) from public;
grant execute on function public.public_heat_replay(uuid,timestamptz) to anon,authenticated;
