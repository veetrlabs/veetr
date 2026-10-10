-- Course diagrams are versioned with the race document. Referees may edit
-- courses, but do not gain permission to edit race or series settings.
create or replace function public.validate_series_courses() returns trigger language plpgsql set search_path='' as $$
declare item record; c jsonb; m jsonb; p jsonb;
begin
 if not (new.document ? 'courses') then return new; end if;
 if jsonb_typeof(new.document->'courses') <> 'object' then raise exception 'Invalid course map'; end if;
 if (select count(*) from jsonb_object_keys(new.document->'courses'))>100 then raise exception 'Invalid course map'; end if;
 for item in select * from jsonb_each(new.document->'courses') loop
  if not exists(select 1 from jsonb_array_elements(coalesce(new.document->'events',new.document->'races')) e where e->>'id'=item.key) then raise exception 'Course must belong to an existing race'; end if;
  c=item.value;
  if jsonb_typeof(c)<>'object' then raise exception 'Invalid course map'; end if;
  if exists(select 1 from jsonb_object_keys(c) k where k not in ('marks','startLine','startBearing','startLive','notes')) then raise exception 'Invalid course map'; end if;
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
  if c ? 'startBearing' then
   m=c->'startBearing'; p=m->'origin';
   if c ? 'startLine' or jsonb_typeof(m)<>'object' then raise exception 'Invalid start bearing'; end if;
   if exists(select 1 from jsonb_object_keys(m) k where k not in ('origin','degrees','distanceMetres')) then raise exception 'Invalid start bearing'; end if;
   if jsonb_typeof(p) is distinct from 'object' then raise exception 'Invalid start position'; end if;
   if exists(select 1 from jsonb_object_keys(p) k where k not in ('latitude','longitude')) then raise exception 'Invalid start position'; end if;
   if jsonb_typeof(p->'latitude') is distinct from 'number' or jsonb_typeof(p->'longitude') is distinct from 'number' then raise exception 'Invalid start position'; end if;
   if abs((p->>'latitude')::numeric)>90 or abs((p->>'longitude')::numeric)>180 then raise exception 'Invalid start position'; end if;
   if jsonb_typeof(m->'degrees') is distinct from 'number' then raise exception 'Invalid start bearing'; end if;
   if (m->>'degrees')::numeric<0 or (m->>'degrees')::numeric>=360 then raise exception 'Invalid start bearing'; end if;
   if m ? 'distanceMetres' then
    if jsonb_typeof(m->'distanceMetres')<>'number' then raise exception 'Invalid start distance'; end if;
    if (m->>'distanceMetres')::numeric<=0 or (m->>'distanceMetres')::numeric>10000 then raise exception 'Invalid start distance'; end if;
   end if;
  end if;
  if c ? 'startLive' then
   m=c->'startLive';
   if not (c ? 'startLine' or c ? 'startBearing') or jsonb_typeof(m)<>'object' then raise exception 'Invalid live start position'; end if;
   if exists(select 1 from jsonb_object_keys(m) k where k not in ('updatedAt','accuracyMetres')) then raise exception 'Invalid live start position'; end if;
   if jsonb_typeof(m->'updatedAt') is distinct from 'string' or jsonb_typeof(m->'accuracyMetres') is distinct from 'number' then raise exception 'Invalid live start position'; end if;
   if not isfinite((m->>'updatedAt')::timestamptz) or (m->>'accuracyMetres')::numeric<0 or (m->>'accuracyMetres')::numeric>50 then raise exception 'Invalid live start position'; end if;
  end if;
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

-- Update only the referee endpoint, preserving other officials' results and marks.
-- Compare the whole expected course so concurrent course edits stop the publisher.
create function public.update_race_start_position(series_id uuid,event_id uuid,expected_course jsonb,fix jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.series; c jsonb; p jsonb; observed timestamptz;
begin
 perform public.require_active_account();
 if auth.uid() is null or not public.is_official(series_id) then raise exception 'Series editing access required'; end if;
 -- Use the same lock order as save_series.
 perform pg_advisory_xact_lock(hashtextextended(series_id::text,0));
 select * into s from public.series where id=series_id for update;
 c=s.document->'courses'->event_id::text;
 if c is null or not (c ? 'startLine' or c ? 'startBearing') then raise exception 'Save a start line before enabling live position'; end if;
 if c is distinct from expected_course then raise exception 'The course changed elsewhere. Stop and reload before tracking again.'; end if;
 if fix is null then
  c=c-'startLive';
 else
  if jsonb_typeof(fix)<>'object' then raise exception 'Invalid GPS fix'; end if;
  if exists(select 1 from jsonb_object_keys(fix) k where k not in ('latitude','longitude','accuracy','timestamp')) then raise exception 'Invalid GPS fix'; end if;
  if jsonb_typeof(fix->'latitude') is distinct from 'number' or jsonb_typeof(fix->'longitude') is distinct from 'number' or jsonb_typeof(fix->'accuracy') is distinct from 'number' or jsonb_typeof(fix->'timestamp') is distinct from 'number' then raise exception 'Invalid GPS fix'; end if;
  if abs((fix->>'latitude')::numeric)>90 or abs((fix->>'longitude')::numeric)>180 or (fix->>'accuracy')::numeric<0 or (fix->>'accuracy')::numeric>50 then raise exception 'Wait for a more accurate GPS position'; end if;
  observed=to_timestamp((fix->>'timestamp')::double precision/1000);
  if not isfinite(observed) or observed<clock_timestamp()-interval '15 seconds' or observed>clock_timestamp()+interval '5 seconds' then raise exception 'GPS position is stale'; end if;
  p=jsonb_build_object('latitude',fix->'latitude','longitude',fix->'longitude');
  if c ? 'startLine' then c=jsonb_set(c,'{startLine,0}',p);
  else c=jsonb_set(c,'{startBearing,origin}',p); end if;
  c=jsonb_set(c,'{startLive}',jsonb_build_object('updatedAt',observed,'accuracyMetres',fix->'accuracy'));
 end if;
 perform public.save_series(jsonb_set(s.document,array['courses',event_id::text],c),s.revision,gen_random_uuid());
 return c;
end; $$;
revoke all on function public.update_race_start_position(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.update_race_start_position(uuid,uuid,jsonb,jsonb) to authenticated;
