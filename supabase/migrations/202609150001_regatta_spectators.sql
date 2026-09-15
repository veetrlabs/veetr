-- Replay is opt-in for new sessions. Existing live-only tracks remain private after stopping.
alter table public.tracking_sessions add column replay_enabled boolean not null default false;
create function public.start_replay_tracking_session(p_id uuid,p_series uuid,p_boat uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; existing boolean;
begin
 select exists(select 1 from public.tracking_sessions where id=p_id) into existing;
 result := public.start_tracking_session(p_id,p_series,p_boat);
 if not existing then update public.tracking_sessions set replay_enabled=true where id=p_id; end if;
 return result;
end;
$$;
revoke all on function public.start_replay_tracking_session(uuid,uuid,uuid) from public;
grant execute on function public.start_replay_tracking_session(uuid,uuid,uuid) to authenticated;

create function public.public_regatta_replay(p_series uuid,p_at timestamptz) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('boatId',b.id,'boatName',b.name,'recordedAt',p.recorded_at,
 'latitude',p.latitude,'longitude',p.longitude,'accuracyM',p.accuracy_m,'sogMps',p.sog_mps,'cogDeg',p.cog_deg,
 'source',p.source,'trail',coalesce((select jsonb_agg(jsonb_build_array(t.latitude,t.longitude) order by t.recorded_at,t.seq)
 from (select latitude,longitude,recorded_at,seq from public.tracking_points where session_id=sess.id
 and recorded_at between p_at-interval '5 minutes' and p_at order by recorded_at desc,seq desc limit 60) t),'[]'::jsonb)) order by b.name),'[]'::jsonb)
 from public.tracking_sessions sess join public.boats b on b.id=sess.boat_id
 join lateral(select * from public.tracking_points where session_id=sess.id and recorded_at<=p_at order by recorded_at desc,seq desc limit 1) p on true
 where sess.series_id=p_series and sess.replay_enabled and p_at<=now()
 and p_at between sess.started_at and least(sess.expires_at,coalesce(sess.stopped_at,sess.expires_at))
 and public.tracking_entry_visible(sess.series_id,sess.boat_id)
 and (b.owner_id=sess.user_id or exists(select 1 from public.boat_members m where m.boat_id=b.id and m.user_id=sess.user_id and m.role='editor'));
$$;
revoke all on function public.public_regatta_replay(uuid,timestamptz) from public;
grant execute on function public.public_regatta_replay(uuid,timestamptz) to anon,authenticated;

create function public.public_regatta_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(d || jsonb_build_object(
 'firstDate',(select min(race_date) from public.races where series_id=(d->>'id')::uuid and status in ('published','locked')),
 'lastDate',(select max(race_date) from public.races where series_id=(d->>'id')::uuid and status in ('published','locked')),
 'liveBoats',(select count(*) from jsonb_array_elements(public.public_tracking_positions((d->>'id')::uuid)) p where (p->>'recordedAt')::timestamptz > now()-interval '60 seconds'),
 'replayStart',bounds.first_point,'replayEnd',bounds.last_point)),'[]'::jsonb)
 from jsonb_array_elements(public.public_series_directory()) d
 left join lateral (
 select min(p.recorded_at) first_point,max(p.recorded_at) last_point
 from public.tracking_sessions sess join public.boats b on b.id=sess.boat_id
 join public.tracking_points p on p.session_id=sess.id
 where sess.series_id=(d->>'id')::uuid and sess.replay_enabled
 and p.recorded_at between sess.started_at and least(now(),sess.expires_at,coalesce(sess.stopped_at,sess.expires_at))
 and public.tracking_entry_visible(sess.series_id,sess.boat_id)
 and (b.owner_id=sess.user_id or exists(select 1 from public.boat_members m where m.boat_id=b.id and m.user_id=sess.user_id and m.role='editor'))
 ) bounds on true;
$$;
revoke all on function public.public_regatta_directory() from public;
grant execute on function public.public_regatta_directory() to anon,authenticated;
