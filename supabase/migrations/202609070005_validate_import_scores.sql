create function public.validate_import_scores() returns trigger language plpgsql set search_path='' as $$
begin
 if new.document ? 'pointsStart' and new.document->'pointsStart' not in ('0'::jsonb,'1'::jsonb) then raise exception 'Invalid points start'; end if;
 if exists(select 1 from jsonb_array_elements(new.document->'events') e where e ? 'countAs' and (jsonb_typeof(e->'countAs')<>'number' or (e->>'countAs')::numeric not between 1 and 10 or (e->>'countAs')::numeric <> trunc((e->>'countAs')::numeric))) then raise exception 'Invalid race count'; end if;
 if exists(select 1 from jsonb_array_elements(new.document->'races') r cross join lateral jsonb_array_elements(r->'results') v where (v->>'status'='SCORED' and not (v ? 'points')) or (v ? 'points' and (jsonb_typeof(v->'points')<>'number' or (v->>'points')::numeric < 0))) then raise exception 'Invalid imported points'; end if;
 return new;
end $$;
create trigger validate_import_scores before insert or update on public.series for each row execute function public.validate_import_scores();
