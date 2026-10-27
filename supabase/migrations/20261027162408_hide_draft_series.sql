-- Draft series override heat publication on every public results endpoint.
-- Keep organizer access through the existing authenticated series policies.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.require_public_series(sid uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.series s where s.id=sid
   and s.status in ('active','completed')
   and exists(select 1 from public.races r where r.series_id=s.id and r.status in ('published','locked'))) then
  raise sqlstate 'PT404' using message='Not found';
 end if;
end;
$$;
revoke all on function private.require_public_series(uuid) from public, anon, authenticated;


create or replace function public.public_series_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by (item->>'year')::integer desc,item->>'name'),'[]'::jsonb)
 from (
  select jsonb_build_object('id',s.id,'name',s.name,'year',s.year,'description',s.description,'status',s.status,
   'raceCount',(select count(*) from public.races r where r.series_id=s.id and r.status in ('published','locked')),
   'boatCount',(select count(distinct e.boat_id) from public.race_entries e join public.races r on r.id=e.race_id where r.series_id=s.id and r.status in ('published','locked'))) item
  from public.series s where s.status in ('active','completed') and exists(select 1 from public.races r where r.series_id=s.id and r.status in ('published','locked'))
 ) published;
$$;

create or replace function public.boat_results(boat_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.public_standings(s.id) order by s.year desc,s.name),'[]'::jsonb)
 from public.series s where s.status in ('active','completed') and exists(select 1 from public.races r join public.race_entries e on e.race_id=r.id where r.series_id=s.id and e.boat_id=boat_results.boat_id and r.status in ('published','locked'));
$$;

create or replace function public.public_standings(series_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_public_series(series_id);
 return (
select jsonb_strip_nulls(jsonb_build_object('id',s.id,'name',s.name,'year',s.year,'description',s.description,'status',s.status,'categories',s.document->'categories',
 'pointsStart',s.document->'pointsStart',
 'courses',(select jsonb_object_agg(c.key,c.value) from jsonb_each(coalesce(s.document->'courses','{}'::jsonb)) c
 where exists(select 1 from jsonb_array_elements(s.document->'races') r where coalesce(r->>'eventId',r->>'id')=c.key and r->>'status' in ('published','locked'))),
 'discards',coalesce((select jsonb_agg(jsonb_build_object('from',d->'from','discard',d->'discard')) from jsonb_array_elements(s.document->'discards') d),'[]'::jsonb),
 'events',case when s.document ? 'events' then (select coalesce(jsonb_agg(jsonb_build_object('id',e->'id','name',e->'name','order',e->'order','weight',e->'weight','startingPoints',e->'startingPoints','completed',e->'completed','countAs',e->'countAs','discards',coalesce((select jsonb_agg(jsonb_build_object('from',d->'from','discard',d->'discard')) from jsonb_array_elements(e->'discards') d),'[]'::jsonb))),'[]'::jsonb) from jsonb_array_elements(s.document->'events') e where exists(select 1 from jsonb_array_elements(s.document->'races') r where r->>'eventId'=e->>'id' and r->>'status' in ('published','locked'))) else null end,
 'boats',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',b->'id','name',b->'name','sailNumber',b->'sailNumber','categoryId',b->'categoryId','className',b->'className','length',b->'length',
  'skipper',case when b->'publishCrew'='true'::jsonb then b->'skipper' else null end,
  'crewNames',case when b->'publishCrew'='true'::jsonb then b->'crewNames' else null end)))
  from jsonb_array_elements(s.document->'boats') b
  where exists(select 1 from public.race_entries e join public.races r on r.id=e.race_id where e.boat_id=(b->>'id')::uuid and r.series_id=s.id and r.status in ('published','locked'))),'[]'::jsonb),
 'races',(select jsonb_agg(jsonb_build_object('id',r->'id','eventId',r->'eventId','kind',r->'kind','name',r->'name','date',r->'date','order',r->'order','weight',r->'weight','status',r->'status','entries',r->'entries',
  'results',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('boatId',v->'boatId','status',v->'status','position',v->'position','points',v->'points','finishedAt',v->'finishedAt'))),'[]'::jsonb) from jsonb_array_elements(r->'results') v))
  order by (r->>'order')::integer) from jsonb_array_elements(s.document->'races') r where r->>'status' in ('published','locked'))))
 from public.series s where s.id=public_standings.series_id and exists(select 1 from public.races where races.series_id=s.id and status in ('published','locked'))
 );
end;
$$;

create or replace function public.public_tracking_positions(p_series uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_public_series(p_series);
 return (
select public.account_tracking_positions(p_series)||public.race_phone_positions(p_series)
 );
end;
$$;

create or replace function public.public_regatta_replay(p_series uuid,p_at timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_public_series(p_series);
 return (
select public.account_regatta_replay(p_series,p_at)||public.race_phone_positions(p_series,p_at)
 );
end;
$$;

create or replace function public.public_heat_replay(p_heat uuid,p_at timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_public_series((select series_id from public.races where id=p_heat));
 return (
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
 coalesce((select jsonb_agg(data) from positions),'[]'::jsonb)) from bounds
 );
end;
$$;

create or replace function public.public_heat_tracking_times(p_heat uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official((select series_id from public.races where id=p_heat)) then
  perform private.require_public_series((select series_id from public.races where id=p_heat));
 end if;
 return (
select jsonb_build_object('start',i.started_at,'end',i.ended_at)
 from public.races r left join public.heat_tracking_intervals i on i.heat_id=r.id
 where r.id=p_heat and (r.status in ('published','locked') or public.is_official(r.series_id))
 );
end;
$$;

create or replace function public.public_race_replay(p_series uuid,p_event uuid,p_heat uuid default null,p_at timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_public_series(p_series);
 return (
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
 'heats',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'start',started_at,'end',ended_at) order by race_order) from heats),'[]'::jsonb)) from bounds
 );
end;
$$;

create or replace function public.public_replay_tracks(p_series uuid,p_event uuid,p_heat uuid default null,
 p_from timestamptz default null,p_offset integer default 0,p_known_count integer default 0,p_known_version text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_public_series(p_series);
 if p_offset<0 or p_known_count<0 then raise exception 'Invalid offset'; end if;
 return (
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

 ), chunks as (
 select floor(extract(epoch from recorded_at)/300)::bigint bucket,
 count(*) total,md5(string_agg(row(p.*)::text,'' order by recorded_at,session_id,boat_id)) version
 from points p group by 1
 ), reusable as (
 select case when p_known_version is not null and p_known_count>0 and
 (select md5(string_agg(row(p.*)::text,'' order by recorded_at,session_id,boat_id))
 from (select * from points where recorded_at>=p_from and recorded_at<p_from+interval '5 minutes'
 order by recorded_at,session_id,boat_id limit p_known_count) p)=p_known_version then p_known_count else 0 end skip
 ), page as (
 select * from points where p_from is not null
 and recorded_at>=p_from and recorded_at<p_from+interval '5 minutes'
 order by recorded_at,session_id,boat_id offset (p_offset+(select skip from reusable)) limit 2000
 )
 select jsonb_build_object(
 'start',(select min(recorded_at) from points),'end',(select max(recorded_at) from points),
 'heats',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'start',started_at,'end',ended_at) order by race_order) from heats),'[]'::jsonb),
 'chunks',coalesce((select jsonb_agg(jsonb_build_object('start',bucket*300000,'count',total,'version',version) order by bucket) from chunks),'[]'::jsonb),
 'points',coalesce((select jsonb_agg(jsonb_build_object('boatId',boat_id,'boatName',boat_name,'sessionId',session_id,
 'recordedAt',recorded_at,'latitude',latitude,'longitude',longitude,'accuracyM',accuracy_m,'sogMps',sog_mps,'cogDeg',cog_deg,'source',source) order by recorded_at,session_id,boat_id) from page),'[]'::jsonb),
 'append',(select skip>0 from reusable),'more',(select count(*)=2000 from page))
 ); end; $$;
