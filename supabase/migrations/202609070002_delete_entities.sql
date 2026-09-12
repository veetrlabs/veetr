create table public.deleted_series (id uuid primary key);
alter table public.deleted_series enable row level security;
create function public.prevent_deleted_series() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.deleted_series where id=new.id) then raise exception 'This series was deleted'; end if;
 return new;
end $$;
create trigger prevent_deleted_series before insert on public.series for each row execute function public.prevent_deleted_series();
create function public.delete_race_entity(series_id uuid, expected_revision integer, event_id uuid default null, heat_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.series; doc jsonb;
begin
 if not public.is_official(series_id,true) then raise exception 'Series admin required'; end if;
 select * into s from public.series where id=series_id for update;
 if s.revision is distinct from expected_revision then raise exception 'Series changed elsewhere. Sync and try again.'; end if;
 if heat_id is null and event_id is null then
   insert into public.deleted_series values(series_id);
   delete from public.race_results where race_id in (select id from public.races where races.series_id=delete_race_entity.series_id);
   delete from public.race_entries where race_entries.series_id=delete_race_entity.series_id;
   delete from public.series_changes where series_changes.series_id=delete_race_entity.series_id;
   delete from public.series where id=series_id;
   return;
 end if;
 doc=s.document;
 if heat_id is not null then
   if not exists(select 1 from jsonb_array_elements(doc->'races') r where r->>'id'=heat_id::text) then raise exception 'Heat not found'; end if;
   doc=jsonb_set(doc,'{races}',coalesce((select jsonb_agg(r) from jsonb_array_elements(doc->'races') r where r->>'id'<>heat_id::text),'[]'));
 else
   if not exists(select 1 from jsonb_array_elements(coalesce(doc->'events',doc->'races')) e where e->>'id'=event_id::text) then raise exception 'Race not found'; end if;
   doc=jsonb_set(doc,'{races}',coalesce((select jsonb_agg(r) from jsonb_array_elements(doc->'races') r where coalesce(r->>'eventId',r->>'id')<>event_id::text),'[]'));
   if doc ? 'events' then doc=jsonb_set(doc,'{events}',coalesce((select jsonb_agg(e) from jsonb_array_elements(doc->'events') e where e->>'id'<>event_id::text),'[]')); end if;
 end if;
 perform public.save_series(doc,expected_revision,gen_random_uuid());
end $$;
create function public.delete_boat(boat_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_edit_boat(boat_id) then raise exception 'Boat owner or series admin required'; end if;
 perform 1 from public.boats where id=boat_id for update;
 if exists(select 1 from public.series_entries where series_entries.boat_id=delete_boat.boat_id) then raise exception 'Remove this boat from all series before deleting its profile'; end if;
 delete from public.boat_members where boat_members.boat_id=delete_boat.boat_id;
 delete from public.boats where id=boat_id;
end $$;
revoke all on function public.delete_race_entity(uuid,integer,uuid,uuid),public.delete_boat(uuid),public.prevent_deleted_series() from public;
grant execute on function public.delete_race_entity(uuid,integer,uuid,uuid),public.delete_boat(uuid) to authenticated;
