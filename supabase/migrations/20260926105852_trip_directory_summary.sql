-- Return one extra row to determine whether a next page actually exists.
create or replace function trip_private.filtered_directory(p_offset integer default 0,p_status text default 'all',p_order text default 'newest')
returns jsonb language sql stable security definer set search_path='' as $$
 with selected as (
 select t.*,s.started_at,s.stopped_at,b.name,b.tracking_color
 from public.trip_shares t join public.tracking_sessions s on s.id=t.session_id
 join public.boats b on b.id=s.boat_id
 where t.visibility='public'
 and (not t.live or (s.stopped_at is null and s.expires_at>now()))
 and not exists(select 1 from public.account_security where user_id=s.user_id and suspended)
 and (p_status='all' or (p_status='active' and t.live) or (p_status='past' and not t.live))
 order by case when p_order='oldest' then s.started_at end asc,
 case when p_order<>'oldest' then s.started_at end desc,t.session_id
 limit 21 offset greatest(0,least(p_offset,10000))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'token',t.token,'title',t.title,'boat',t.name,'live',t.live,
 'startedAt',t.started_at,'stoppedAt',t.stopped_at,'color',t.tracking_color,
 'distanceNm',coalesce(d.nm,0),'startLatitude',first_fix.latitude,'startLongitude',first_fix.longitude)
 order by case when p_order='oldest' then t.started_at end asc,
 case when p_order<>'oldest' then t.started_at end desc,t.session_id),'[]'::jsonb)
 from selected t
 left join lateral (select latitude,longitude from public.tracking_points
 where session_id=t.session_id order by recorded_at,seq limit 1) first_fix on true
 left join lateral (
 select sum(case when prev_time is null or recorded_at-prev_time>interval '60 seconds' then 0 else
 6371000 * 2 * asin(sqrt(least(1.0,
 power(sin(radians(latitude-prev_lat)/2),2) +
 cos(radians(prev_lat))*cos(radians(latitude))*power(sin(radians(longitude-prev_lon)/2),2)))) / 1852 end) nm
 from (select latitude,longitude,recorded_at,
 lag(latitude) over w prev_lat,lag(longitude) over w prev_lon,lag(recorded_at) over w prev_time
 from public.tracking_points where session_id=t.session_id window w as (order by recorded_at,seq)) points
 ) d on true;
$$;
