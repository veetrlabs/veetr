create or replace function trip_private.read_trip(p_token uuid,p_after bigint default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.tracking_sessions; t public.trip_shares; chunk jsonb; last_point jsonb;
begin
 select * into t from public.trip_shares where token=p_token and visibility<>'private';
 if not found then return null; end if;
 select * into s from public.tracking_sessions where id=t.session_id;
 if (t.live and (s.stopped_at is not null or s.expires_at<=now())) or exists(select 1 from public.account_security where user_id=s.user_id and suspended) then return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('seq',seq,'recordedAt',recorded_at,'latitude',latitude,'longitude',longitude,'sogMps',sog_mps,'cogDeg',cog_deg,'instruments',instruments) order by seq),'[]') into chunk
 from (select * from public.tracking_points where session_id=s.id and seq>greatest(0,p_after) order by seq limit 2000) points;
 select jsonb_build_object('recordedAt',recorded_at,'sogMps',sog_mps,'cogDeg',cog_deg,'instruments',instruments) into last_point from public.tracking_points where session_id=s.id order by recorded_at desc,seq desc limit 1;
 return jsonb_build_object('title',t.title,'boatSlug',(select slug from public.boats where id=s.boat_id),'boat',(select name from public.boats where id=s.boat_id),'color',(select tracking_color from public.boats where id=s.boat_id),'live',t.live,'startedAt',s.started_at,'stoppedAt',s.stopped_at,'latest',last_point,'points',chunk);
end $$;
