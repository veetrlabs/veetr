-- Public boat specifications and one reference polar. Device links never write here.
create function public.valid_boat_specifications(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; p jsonb; pt jsonb; max_value numeric;
begin
 if jsonb_typeof(value) <> 'object' or pg_column_size(value)>2000000 then return false; end if;
 if exists(select 1 from jsonb_object_keys(value) key where key not in
   ('sailNumber','manufacturer','model','variant','waterlineLengthM','draftM','airDraftM','beamM','polar')) then return false; end if;
 foreach k in array array['sailNumber','manufacturer','model','variant'] loop
  if value ? k and (jsonb_typeof(value->k)<>'string' or length(value->>k)>120) then return false; end if;
 end loop;
 foreach k in array array['waterlineLengthM','draftM','airDraftM','beamM'] loop
  max_value:=case k when 'draftM' then 30 when 'beamM' then 100 else 200 end;
  if value ? k then
   if jsonb_typeof(value->k)<>'number' then return false; end if;
   if (value->>k)::numeric<=0 or (value->>k)::numeric>max_value then return false; end if;
  end if;
 end loop;
 if value ? 'polar' then
  p:=value->'polar';
  if jsonb_typeof(p)<>'object' then return false; end if;
  if exists(select 1 from jsonb_object_keys(p) key where key not in ('id','name','version','source','createdAt','sourceUrl','sourceVersion','speedBasis','points')) then return false; end if;
  foreach k in array array['id','name','version','source','createdAt'] loop
   if not (p ? k) or jsonb_typeof(p->k)<>'string' or length(trim(p->>k))=0 or length(p->>k)>500 then return false; end if;
  end loop;
  if p->>'source' not in ('manufacturer','orc','upload','manual','learned','community') then return false; end if;
  perform (p->>'createdAt')::timestamptz;
  foreach k in array array['sourceUrl','sourceVersion','speedBasis'] loop
   if p ? k and (jsonb_typeof(p->k)<>'string' or length(p->>k)>2048) then return false; end if;
  end loop;
  if p ? 'speedBasis' and p->>'speedBasis' not in ('water','ground') then return false; end if;
  if not (p ? 'points') or jsonb_typeof(p->'points')<>'array' then return false; end if;
  if jsonb_array_length(p->'points') not between 1 and 20000 then return false; end if;
  for pt in select * from jsonb_array_elements(p->'points') loop
   if jsonb_typeof(pt)<>'object' then return false; end if;
   if exists(select 1 from jsonb_object_keys(pt) key where key not in ('tws','twa','speed')) then return false; end if;
   foreach k in array array['tws','twa','speed'] loop
    if not (pt ? k) or jsonb_typeof(pt->k)<>'number' then return false; end if;
    max_value:=case k when 'tws' then 150 when 'twa' then 180 else 100 end;
    if (pt->>k)::numeric<0 or (pt->>k)::numeric>max_value then return false; end if;
   end loop;
  end loop;
  if exists(select 1 from jsonb_array_elements(p->'points') as element(point) group by (element.point->>'tws')::numeric,(element.point->>'twa')::numeric having count(*)>1) then return false; end if;
 end if;
 return true;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end $$;

alter table public.boats add column specifications jsonb not null default '{}'::jsonb
 check(public.valid_boat_specifications(specifications));
alter table public.boats add constraint boat_waterline_length_check
 check(not (specifications ? 'waterlineLengthM') or length_m is null or (specifications->>'waterlineLengthM')::numeric<=length_m);

-- Keep the directory lightweight: load the polar only on the boat detail page.
create function public.boat_specifications(bid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select specifications from public.boats where id=bid;
$$;
create function public.save_boat_specifications(bid uuid, details jsonb, expected jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin
 perform public.require_active_account();
 select specifications into previous from public.boats where id=bid for update;
 if not public.can_edit_boat(bid) then raise exception 'Boat owner or editor required'; end if;
 if previous is distinct from expected then raise exception 'Boat changed elsewhere. Reopen the editor to load the latest details.'; end if;
 if details is null or not public.valid_boat_specifications(details) then raise exception 'Invalid boat specifications or polar data.'; end if;
 update public.boats set specifications=details,updated_at=now() where id=bid;
 return details;
end $$;
revoke all on function public.boat_specifications(uuid),public.save_boat_specifications(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.boat_specifications(uuid) to anon,authenticated;
grant execute on function public.save_boat_specifications(uuid,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
