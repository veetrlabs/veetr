-- Raw authorized GPS chunks; playback frames are computed in browser memory.
create function public.public_replay_tracks(p_series uuid,p_event uuid,p_heat uuid default null,
 p_from timestamptz default null,p_offset integer default 0,p_known_count integer default 0,p_known_version text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
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
revoke all on function public.public_replay_tracks(uuid,uuid,uuid,timestamptz,integer,integer,text) from public;
grant execute on function public.public_replay_tracks(uuid,uuid,uuid,timestamptz,integer,integer,text) to anon,authenticated;
