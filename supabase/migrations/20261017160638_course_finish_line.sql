-- Finish defaults to the start line when neither finish field is stored.
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
  if exists(select 1 from jsonb_object_keys(c) k where k not in ('marks','startLine','startBearing','startLive','notes','finishLine','finishBearing')) then raise exception 'Invalid course map'; end if;
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
  if c ? 'finishBearing' then
   m=c->'finishBearing'; p=m->'origin';
   if not (m ? 'distanceMetres') then raise exception 'Finish length is required'; end if;
   if c ? 'finishLine' or jsonb_typeof(m)<>'object' then raise exception 'Invalid finish bearing'; end if;
   if exists(select 1 from jsonb_object_keys(m) k where k not in ('origin','degrees','distanceMetres')) then raise exception 'Invalid finish bearing'; end if;
   if jsonb_typeof(p) is distinct from 'object' then raise exception 'Invalid finish position'; end if;
   if exists(select 1 from jsonb_object_keys(p) k where k not in ('latitude','longitude')) then raise exception 'Invalid finish position'; end if;
   if jsonb_typeof(p->'latitude') is distinct from 'number' or jsonb_typeof(p->'longitude') is distinct from 'number' then raise exception 'Invalid finish position'; end if;
   if abs((p->>'latitude')::numeric)>90 or abs((p->>'longitude')::numeric)>180 then raise exception 'Invalid finish position'; end if;
   if jsonb_typeof(m->'degrees') is distinct from 'number' then raise exception 'Invalid finish bearing'; end if;
   if (m->>'degrees')::numeric<0 or (m->>'degrees')::numeric>=360 then raise exception 'Invalid finish bearing'; end if;
   if m ? 'distanceMetres' then
    if jsonb_typeof(m->'distanceMetres')<>'number' then raise exception 'Invalid finish distance'; end if;
    if (m->>'distanceMetres')::numeric<=0 or (m->>'distanceMetres')::numeric>10000 then raise exception 'Invalid finish distance'; end if;
   end if;
  end if;
  if c ? 'finishLine' then
   if jsonb_typeof(c->'finishLine')<>'array' then raise exception 'Place both ends of the finish line'; end if;
   if jsonb_array_length(c->'finishLine')<>2 then raise exception 'Place both ends of the finish line'; end if;
   for p in select value from jsonb_array_elements(c->'finishLine') loop
    if jsonb_typeof(p)<>'object' then raise exception 'Invalid course position'; end if;
    if exists(select 1 from jsonb_object_keys(p) k where k not in ('latitude','longitude')) then raise exception 'Invalid course position'; end if;
   end loop;
  end if;
  for p in select value from jsonb_array_elements((c->'marks') || coalesce(c->'finishLine','[]'::jsonb)) loop
   if jsonb_typeof(p->'latitude') is distinct from 'number' or jsonb_typeof(p->'longitude') is distinct from 'number' then raise exception 'Invalid course position'; end if;
   if abs((p->>'latitude')::numeric)>90 or abs((p->>'longitude')::numeric)>180 then raise exception 'Invalid course position'; end if;
  end loop;
  if c ? 'finishLine' and (c->'finishLine'->0->>'latitude')::numeric=(c->'finishLine'->1->>'latitude')::numeric
   and mod((c->'finishLine'->0->>'longitude')::numeric-(c->'finishLine'->1->>'longitude')::numeric,360)=0 then raise exception 'The finish line needs two different positions'; end if;
 end loop;
 return new;
end; $$;
