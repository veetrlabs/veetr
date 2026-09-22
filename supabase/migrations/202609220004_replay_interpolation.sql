-- Supply the next authorized fix in the same response for client-side interpolation.
create or replace function public.public_race_replay(p_series uuid,p_event uuid,p_heat uuid default null,p_at timestamptz default null) returns jsonb
language sql stable security definer set search_path='' as $$
 with heats as materialized (
 select r.id,r.name,r.race_order,i.started_at,i.ended_at from public.races r
 join public.series s on s.id=r.series_id,
 lateral jsonb_array_elements(s.document->'races') h
 left join public.heat_tracking_intervals i on i.heat_id=(h->>'id')::uuid
 where r.series_id=p_series and h->>'id'=r.id::text
 and coalesce(h->>'eventId',h->>'id')=p_event::text
 and r.status in ('published','locked') and h->>'status' in ('published','locked')
 ), points as materialized (
 select distinct p.* from heats h cross join lateral public.heat_replay_points(h.id) p
 where p_heat is null or (h.id=p_heat and h.started_at is not null
 and p.recorded_at between h.started_at and coalesce(h.ended_at,now()))
 ), bounds as(select min(recorded_at) first_point,max(recorded_at) last_point from points),
 frame as(select least(greatest(coalesce(p_at,first_point),first_point),last_point) stamp from bounds),
 latest as(select distinct on(boat_id) p.* from points p,frame f
 where p.recorded_at<=f.stamp and p.recorded_at>=f.stamp-interval '5 minutes'
 order by boat_id,recorded_at desc,session_id),
 positions as(select jsonb_build_object('boatId',p.boat_id,'boatName',p.boat_name,'recordedAt',p.recorded_at,
 'latitude',p.latitude,'longitude',p.longitude,'accuracyM',p.accuracy_m,'sogMps',p.sog_mps,'cogDeg',p.cog_deg,'source',p.source,
 'futureFixes',(select coalesce(jsonb_agg(jsonb_build_object('recordedAt',n.recorded_at,'latitude',n.latitude,'longitude',n.longitude) order by n.recorded_at),'[]'::jsonb)
 from (select distinct on (floor(extract(epoch from q.recorded_at)/5)) q.recorded_at,q.latitude,q.longitude
 from points q where q.session_id=p.session_id and q.recorded_at>p.recorded_at and q.recorded_at<=p.recorded_at+interval '125 seconds'
 order by floor(extract(epoch from q.recorded_at)/5),q.recorded_at) n),
 'nextFix',(select jsonb_build_object('recordedAt',n.recorded_at,'latitude',n.latitude,'longitude',n.longitude)
 from points n where n.session_id=p.session_id and n.recorded_at>p.recorded_at
 and n.recorded_at<=p.recorded_at+interval '60 seconds' order by n.recorded_at limit 1),
 'trail',(select coalesce(jsonb_agg(jsonb_build_array(t.latitude,t.longitude) order by t.recorded_at),'[]'::jsonb)
 from (select q.* from points q,frame f where q.session_id=p.session_id
 and q.recorded_at between f.stamp-interval '5 minutes' and f.stamp order by q.recorded_at desc limit 60) t)) data from latest p)
 select jsonb_build_object('start',first_point,'end',last_point,'positions',coalesce((select jsonb_agg(data) from positions),'[]'::jsonb),
 'heats',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'start',started_at,'end',ended_at) order by race_order) from heats),'[]'::jsonb)) from bounds;
$$;
revoke all on function public.public_race_replay(uuid,uuid,uuid,timestamptz) from public;
grant execute on function public.public_race_replay(uuid,uuid,uuid,timestamptz) to anon,authenticated;
