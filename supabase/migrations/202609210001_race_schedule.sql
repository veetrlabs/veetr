-- Preserve existing tracking schedules in the race entity before making it authoritative.
update public.series s set document=jsonb_set(s.document,'{events}',(
 select jsonb_agg(case when e ? 'scheduledStart' or t.id is null then e else e || jsonb_build_object('scheduledStart',t.scheduled_start) end order by n)
 from jsonb_array_elements(s.document->'events') with ordinality x(e,n)
 left join public.race_tracking_events t on t.series_id=s.id and t.event_id=(e->>'id')::uuid
)), revision=revision+1
where jsonb_typeof(s.document->'events')='array' and exists(select 1 from public.race_tracking_events t where t.series_id=s.id);

create function public.configure_race_tracking(sid uuid,eid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare race jsonb; starts timestamptz; result uuid;
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 select item into race from public.series s,jsonb_array_elements(coalesce(s.document->'events',s.document->'races')) item where s.id=sid and item->>'id'=eid::text;
 if race is null then raise exception 'Race not found'; end if;
 starts=nullif(race->>'scheduledStart','')::timestamptz;
 if starts is null then raise exception 'Set the start time in Edit race first'; end if;
 if starts+interval '18 hours'<=now() then raise exception 'This race has ended. Update its start time in Edit race'; end if;
 insert into public.race_tracking_events(series_id,event_id,name,scheduled_start,expires_at)
 values(sid,eid,race->>'name',starts,starts+interval '18 hours')
 on conflict(series_id,event_id) do update set name=excluded.name,scheduled_start=excluded.scheduled_start,expires_at=excluded.expires_at returning id into result;
 return result;
end; $$;
revoke all on function public.configure_race_tracking(uuid,uuid) from public,anon,authenticated;
grant execute on function public.configure_race_tracking(uuid,uuid) to authenticated;
-- Older clients cannot override the race's schedule from an invitation form.
create or replace function public.configure_race_tracking(sid uuid,eid uuid,starts_at timestamptz) returns uuid language sql security definer set search_path='' as $$
 select public.configure_race_tracking(sid,eid);
$$;

create function public.sync_race_tracking_schedule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.race_tracking_events t set name=e->>'name',scheduled_start=(e->>'scheduledStart')::timestamptz,expires_at=(e->>'scheduledStart')::timestamptz+interval '18 hours'
 from jsonb_array_elements(coalesce(new.document->'events',new.document->'races')) e
 where t.series_id=new.id and t.event_id::text=e->>'id' and nullif(e->>'scheduledStart','') is not null;
 if exists(select 1 from public.race_tracking_events t,jsonb_array_elements(coalesce(new.document->'events',new.document->'races')) e where t.series_id=new.id and t.event_id::text=e->>'id' and nullif(e->>'scheduledStart','') is null) then raise exception 'A race with invitations must keep its start time'; end if;
 return new;
end; $$;
revoke all on function public.sync_race_tracking_schedule() from public,anon,authenticated;
create trigger sync_race_tracking_schedule after update of document on public.series for each row execute function public.sync_race_tracking_schedule();
