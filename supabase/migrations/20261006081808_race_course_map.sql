-- Course diagrams are versioned with the race document. Referees may edit
-- courses, but do not gain permission to edit race or series settings.
create function public.validate_series_courses() returns trigger language plpgsql set search_path='' as $$
declare item record; c jsonb; m jsonb; p jsonb;
begin
 if not (new.document ? 'courses') then return new; end if;
 if jsonb_typeof(new.document->'courses') <> 'object' then raise exception 'Invalid course map'; end if;
 if (select count(*) from jsonb_object_keys(new.document->'courses'))>100 then raise exception 'Invalid course map'; end if;
 for item in select * from jsonb_each(new.document->'courses') loop
  if not exists(select 1 from jsonb_array_elements(coalesce(new.document->'events',new.document->'races')) e where e->>'id'=item.key) then raise exception 'Course must belong to an existing race'; end if;
  c=item.value;
  if jsonb_typeof(c)<>'object' then raise exception 'Invalid course map'; end if;
  if exists(select 1 from jsonb_object_keys(c) k where k not in ('marks','startLine','notes')) then raise exception 'Invalid course map'; end if;
  if jsonb_typeof(c->'marks') is distinct from 'array' then raise exception 'Invalid course map'; end if;
  if jsonb_array_length(c->'marks')>40 or (c ? 'notes' and (jsonb_typeof(c->'notes')<>'string' or length(c->>'notes')>1000)) then raise exception 'Invalid course map'; end if;
  for m in select value from jsonb_array_elements(c->'marks') loop
   if jsonb_typeof(m)<>'object' then raise exception 'Invalid course mark'; end if;
   if exists(select 1 from jsonb_object_keys(m) k where k not in ('id','name','latitude','longitude','rounding')) then raise exception 'Invalid course mark'; end if;
   if jsonb_typeof(m->'id') is distinct from 'string' or (m->>'id') !~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    or jsonb_typeof(m->'name') is distinct from 'string' or length(btrim(m->>'name'))=0 or length(m->>'name')>80
    or coalesce(m->>'rounding','') not in ('port','starboard') then raise exception 'Invalid course mark'; end if;
  end loop;
  if (select count(distinct mark_row.value->>'id') from jsonb_array_elements(c->'marks') mark_row(value))<>jsonb_array_length(c->'marks') then raise exception 'Course marks need unique IDs'; end if;
  if c ? 'startLine' then
   if jsonb_typeof(c->'startLine')<>'array' then raise exception 'Place both ends of the start line'; end if;
   if jsonb_array_length(c->'startLine')<>2 then raise exception 'Place both ends of the start line'; end if;
   for p in select value from jsonb_array_elements(c->'startLine') loop
    if jsonb_typeof(p)<>'object' then raise exception 'Invalid course position'; end if;
    if exists(select 1 from jsonb_object_keys(p) k where k not in ('latitude','longitude')) then raise exception 'Invalid course position'; end if;
   end loop;
  end if;
  for p in select value from jsonb_array_elements((c->'marks') || coalesce(c->'startLine','[]'::jsonb)) loop
   if jsonb_typeof(p->'latitude') is distinct from 'number' or jsonb_typeof(p->'longitude') is distinct from 'number' then raise exception 'Invalid course position'; end if;
   if abs((p->>'latitude')::numeric)>90 or abs((p->>'longitude')::numeric)>180 then raise exception 'Invalid course position'; end if;
  end loop;
  if c ? 'startLine' and (c->'startLine'->0->>'latitude')::numeric=(c->'startLine'->1->>'latitude')::numeric
   and mod((c->'startLine'->0->>'longitude')::numeric-(c->'startLine'->1->>'longitude')::numeric,360)=0 then raise exception 'The start line needs two different positions'; end if;
 end loop;
 return new;
end; $$;
revoke all on function public.validate_series_courses() from public,anon,authenticated;
create trigger validate_series_courses before insert or update of document on public.series for each row execute function public.validate_series_courses();

create or replace function public.save_series(payload jsonb,expected_revision integer,mutation_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare e jsonb; previous jsonb;
begin
 perform public.require_active_account();
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform public.validate_discard_rules(payload->'discards');
 if payload ? 'events' then
  if jsonb_typeof(payload->'events')<>'array' then raise exception 'Invalid events'; end if;
  if (select count(distinct v->>'id') from jsonb_array_elements(payload->'events') v)<>jsonb_array_length(payload->'events') or (select count(distinct v->>'order') from jsonb_array_elements(payload->'events') v)<>jsonb_array_length(payload->'events') then raise exception 'Events need unique IDs and order'; end if;
  for e in select value from jsonb_array_elements(payload->'events') loop
   perform (e->>'id')::uuid;
   if coalesce(length(trim(e->>'name')),0)=0 or coalesce((e->>'order')::numeric,0)<1 or (e->>'order')::numeric<>trunc((e->>'order')::numeric) or coalesce((e->>'weight')::numeric,0)<=0 or jsonb_typeof(e->'completed') is distinct from 'boolean' then raise exception 'Invalid event'; end if;
   perform public.validate_discard_rules(e->'discards');
  end loop;
  if exists(select 1 from jsonb_array_elements(payload->'races') r where not exists(select 1 from jsonb_array_elements(payload->'events') event_row where event_row->>'id'=r->>'eventId')) then raise exception 'Every heat needs an event'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(payload->>'id',0));
 select document into previous from public.series where id=(payload->>'id')::uuid for update;
 if previous is not null and public.is_official((payload->>'id')::uuid) and not public.is_official((payload->>'id')::uuid,true) then
  if (payload-'races'-'courses') is distinct from (previous-'races'-'courses') then raise exception 'Series manager required to change series settings'; end if;
  if (select coalesce(jsonb_agg(r-'results'-'entries'-'status' order by r->>'id'),'[]'::jsonb) from jsonb_array_elements(payload->'races') r)
    is distinct from (select coalesce(jsonb_agg(r-'results'-'entries'-'status' order by r->>'id'),'[]'::jsonb) from jsonb_array_elements(previous->'races') r) then
   raise exception 'Series manager required to change heat settings';
  end if;
 end if;
 return public.save_series_snapshot(payload,expected_revision,mutation_id);
end; $$;

create or replace function public.public_standings(series_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
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
 from public.series s where s.id=series_id and exists(select 1 from public.races where races.series_id=s.id and status in ('published','locked'));
$$;

create or replace function public.delete_race_entity(series_id uuid, expected_revision integer, event_id uuid default null, heat_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
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
 if doc ? 'courses' then
  doc=jsonb_set(doc,'{courses}',coalesce((select jsonb_object_agg(c.key,c.value) from jsonb_each(doc->'courses') c
   where exists(select 1 from jsonb_array_elements(coalesce(doc->'events',doc->'races')) e where e->>'id'=c.key)),'{}'::jsonb));
 end if;
 perform public.save_series(doc,expected_revision,gen_random_uuid());
end $$;
