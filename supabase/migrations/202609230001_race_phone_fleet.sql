-- Resolve the invitation's tracking-event id to the public race id on the server.
-- Only public race positions are returned; the phone secret grants no extra visibility.
create function public.race_phone_fleet(lid uuid, device_secret text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.race_tracking_events;
begin
 perform public.check_race_phone(lid,device_secret);
 select t.* into e from public.race_tracking_events t
 join public.race_tracking_links l on l.event_id=t.id where l.id=lid and l.revoked_at is null;
 if e.id is null then raise exception 'Invitation unavailable'; end if;
 return public.public_race_replay(e.series_id,e.event_id,null,now())->'positions';
end; $$;
revoke all on function public.race_phone_fleet(uuid,text) from public;
grant execute on function public.race_phone_fleet(uuid,text) to anon,authenticated;
