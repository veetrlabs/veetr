-- Replay boundaries are independent of scoring and GPS collection.
create table public.heat_tracking_intervals (
 heat_id uuid primary key references public.races on delete cascade,
 started_at timestamptz not null,
 ended_at timestamptz,
 check(ended_at is null or ended_at>started_at)
);
alter table public.heat_tracking_intervals enable row level security;
revoke all on public.heat_tracking_intervals from anon,authenticated;
create function public.set_heat_tracking_times(p_heat uuid,p_start timestamptz,p_end timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 select series_id into sid from public.races where id=p_heat for update;
 if sid is null or not public.is_official(sid) then raise exception 'Race official required'; end if;
 if p_start is null or p_start>now() or p_end>now() or p_end<=p_start then raise exception 'Choose valid past heat times'; end if;
 insert into public.heat_tracking_intervals values(p_heat,p_start,p_end)
 on conflict(heat_id) do update set started_at=excluded.started_at,ended_at=excluded.ended_at;
end; $$;
create function public.mark_heat_tracking(p_heat uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid; times public.heat_tracking_intervals;
begin
 select series_id into sid from public.races where id=p_heat for update;
 if sid is null or not public.is_official(sid) then raise exception 'Race official required'; end if;
 select * into times from public.heat_tracking_intervals where heat_id=p_heat;
 if p_action='start' and times.heat_id is null then
 perform public.set_heat_tracking_times(p_heat,now(),null);
 elsif p_action='end' and times.heat_id is not null and times.ended_at is null then
 perform public.set_heat_tracking_times(p_heat,times.started_at,now());
 else raise exception 'Heat has already started or ended'; end if;
end; $$;
create function public.public_heat_tracking_times(p_heat uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('start',i.started_at,'end',i.ended_at)
 from public.races r left join public.heat_tracking_intervals i on i.heat_id=r.id
 where r.id=p_heat and (r.status in ('published','locked') or public.is_official(r.series_id));
$$;
revoke all on function public.set_heat_tracking_times(uuid,timestamptz,timestamptz),public.mark_heat_tracking(uuid,text),public.public_heat_tracking_times(uuid) from public;
grant execute on function public.set_heat_tracking_times(uuid,timestamptz,timestamptz),public.mark_heat_tracking(uuid,text) to authenticated;
grant execute on function public.public_heat_tracking_times(uuid) to anon,authenticated;

create function public.public_race_replay(p_series uuid,p_event uuid,p_heat uuid default null,p_at timestamptz default null) returns jsonb
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
 'trail',(select coalesce(jsonb_agg(jsonb_build_array(t.latitude,t.longitude) order by t.recorded_at),'[]'::jsonb)
 from (select q.* from points q,frame f where q.session_id=p.session_id
 and q.recorded_at between f.stamp-interval '5 minutes' and f.stamp order by q.recorded_at desc limit 60) t)) data from latest p)
 select jsonb_build_object('start',first_point,'end',last_point,'positions',coalesce((select jsonb_agg(data) from positions),'[]'::jsonb),
 'heats',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'start',started_at,'end',ended_at) order by race_order) from heats),'[]'::jsonb)) from bounds;
$$;
revoke all on function public.public_race_replay(uuid,uuid,uuid,timestamptz) from public;
grant execute on function public.public_race_replay(uuid,uuid,uuid,timestamptz) to anon,authenticated;
