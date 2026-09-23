-- Compatibility for installed clients: retain old boats and complete session trails.
create or replace function public.race_phone_fleet(lid uuid, device_secret text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.race_tracking_events;
begin
 perform public.check_race_phone(lid,device_secret);
 select t.* into e from public.race_tracking_events t
 join public.race_tracking_links l on l.event_id=t.id where l.id=lid and l.revoked_at is null;
 if e.id is null then raise exception 'Invitation unavailable'; end if;
 return (
 with heats as materialized (
 select r.id from public.races r join public.series s on s.id=r.series_id,
 lateral jsonb_array_elements(s.document->'races') h
 where r.series_id=e.series_id and h->>'id'=r.id::text
 and coalesce(h->>'eventId',h->>'id')=e.event_id::text
 and r.status in ('published','locked') and h->>'status' in ('published','locked')
 ), points as materialized (
 select distinct p.* from heats h cross join lateral public.heat_replay_points(h.id) p
 ), latest as (
 select distinct on(boat_id) * from points order by boat_id,recorded_at desc,session_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('boatId',p.boat_id,'boatName',p.boat_name,
 'recordedAt',p.recorded_at,'latitude',p.latitude,'longitude',p.longitude,
 'accuracyM',p.accuracy_m,'sogMps',p.sog_mps,'cogDeg',p.cog_deg,'source',p.source,
 'trail',(select jsonb_agg(jsonb_build_array(q.latitude,q.longitude) order by q.recorded_at)
 from points q where q.session_id=p.session_id))), '[]'::jsonb) from latest p);
end; $$;

-- Updated clients cache authorized chunks instead of re-downloading full trails.
create function public.race_phone_tracks(lid uuid,device_secret text,p_from timestamptz default null,
 p_offset integer default 0,p_known_count integer default 0,p_known_version text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.race_tracking_events;
begin
 perform public.check_race_phone(lid,device_secret);
 select t.* into e from public.race_tracking_events t
 join public.race_tracking_links l on l.event_id=t.id where l.id=lid and l.revoked_at is null;
 if e.id is null then raise exception 'Invitation unavailable'; end if;
 return public.public_replay_tracks(e.series_id,e.event_id,null,p_from,p_offset,p_known_count,p_known_version);
end; $$;
revoke all on function public.race_phone_tracks(uuid,text,timestamptz,integer,integer,text) from public;
grant execute on function public.race_phone_tracks(uuid,text,timestamptz,integer,integer,text) to anon,authenticated;
