create or replace function public.public_standings(series_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'name',s.name,'year',s.year,'description',s.description,'status',s.status,'categories',s.document->'categories',
 'discards',coalesce((select jsonb_agg(jsonb_build_object('from',d->'from','discard',d->'discard')) from jsonb_array_elements(s.document->'discards') d),'[]'::jsonb),
 'events',case when s.document ? 'events' then (select coalesce(jsonb_agg(jsonb_build_object('id',e->'id','name',e->'name','order',e->'order','weight',e->'weight','completed',e->'completed','discards',coalesce((select jsonb_agg(jsonb_build_object('from',d->'from','discard',d->'discard')) from jsonb_array_elements(e->'discards') d),'[]'::jsonb))),'[]'::jsonb) from jsonb_array_elements(s.document->'events') e where exists(select 1 from jsonb_array_elements(s.document->'races') r where r->>'eventId'=e->>'id' and r->>'status' in ('published','locked'))) else null end,
 'boats',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',b->'id','name',b->'name','sailNumber',b->'sailNumber','categoryId',b->'categoryId','className',b->'className','length',b->'length',
  'skipper',case when b->'publishCrew'='true'::jsonb then b->'skipper' else null end,
  'crewNames',case when b->'publishCrew'='true'::jsonb then b->'crewNames' else null end)))
  from jsonb_array_elements(s.document->'boats') b
  where exists(select 1 from public.race_entries e join public.races r on r.id=e.race_id where e.boat_id=(b->>'id')::uuid and r.series_id=s.id and r.status in ('published','locked'))),'[]'::jsonb),
 'races',(select jsonb_agg(jsonb_build_object('id',r->'id','eventId',r->'eventId','name',r->'name','date',r->'date','order',r->'order','weight',r->'weight','status',r->'status','entries',r->'entries',
  'results',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('boatId',v->'boatId','status',v->'status','position',v->'position','finishedAt',v->'finishedAt'))),'[]'::jsonb) from jsonb_array_elements(r->'results') v))
  order by (r->>'order')::integer) from jsonb_array_elements(s.document->'races') r where r->>'status' in ('published','locked')))
 from public.series s where s.id=series_id and exists(select 1 from public.races where races.series_id=s.id and status in ('published','locked'));
$$;

create function public.validate_discard_rules(rules jsonb) returns void language plpgsql set search_path='' as $$
begin
 if rules is null then return; end if;
 if jsonb_typeof(rules)<>'array' then raise exception 'Invalid discard rules'; end if;
 if exists(select 1 from jsonb_array_elements(rules) r where jsonb_typeof(r->'from') is distinct from 'number' or jsonb_typeof(r->'discard') is distinct from 'number' or (r->>'from')::numeric < 1 or (r->>'from')::numeric <> trunc((r->>'from')::numeric) or (r->>'discard')::numeric < 0 or (r->>'discard')::numeric >= (r->>'from')::numeric or (r->>'discard')::numeric <> trunc((r->>'discard')::numeric)) or (select count(distinct r->>'from') from jsonb_array_elements(rules) r)<>jsonb_array_length(rules) then raise exception 'Invalid discard thresholds'; end if;
end; $$;
alter function public.save_series(jsonb,integer,uuid) rename to save_series_snapshot;
do $$ begin execute replace(pg_get_functiondef('public.save_series_snapshot(jsonb,integer,uuid)'::regprocedure),'save_series.mutation_id','save_series_snapshot.mutation_id'); end; $$;

revoke all on function public.save_series_snapshot(jsonb,integer,uuid) from public,anon,authenticated;
create function public.save_series(payload jsonb,expected_revision integer,mutation_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare e jsonb;
begin
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
 return public.save_series_snapshot(payload,expected_revision,mutation_id);
end; $$;
revoke all on function public.save_series(jsonb,integer,uuid) from public;
grant execute on function public.save_series(jsonb,integer,uuid) to authenticated;
