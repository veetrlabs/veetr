create index races_published_series_idx on public.races(series_id) where status in ('published','locked');
create function public.public_series_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by (item->>'year')::integer desc,item->>'name'),'[]'::jsonb)
 from (
  select jsonb_build_object('id',s.id,'name',s.name,'year',s.year,'description',s.description,'status',s.status,
   'raceCount',(select count(*) from public.races r where r.series_id=s.id and r.status in ('published','locked')),
   'boatCount',(select count(distinct e.boat_id) from public.race_entries e join public.races r on r.id=e.race_id where r.series_id=s.id and r.status in ('published','locked'))) item
  from public.series s where exists(select 1 from public.races r where r.series_id=s.id and r.status in ('published','locked'))
 ) published;
$$;
create or replace function public.public_standings(series_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'name',s.name,'year',s.year,'description',s.description,'status',s.status,'categories',s.document->'categories',
 'boats',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',b->'id','name',b->'name','sailNumber',b->'sailNumber','categoryId',b->'categoryId','className',b->'className','length',b->'length',
  'skipper',case when b->'publishCrew'='true'::jsonb then b->'skipper' else null end,
  'crewNames',case when b->'publishCrew'='true'::jsonb then b->'crewNames' else null end)))
  from jsonb_array_elements(s.document->'boats') b
  where exists(select 1 from public.race_entries e join public.races r on r.id=e.race_id where e.boat_id=(b->>'id')::uuid and r.series_id=s.id and r.status in ('published','locked'))),'[]'::jsonb),
 'races',(select jsonb_agg(jsonb_build_object('id',r->'id','name',r->'name','date',r->'date','order',r->'order','weight',r->'weight','status',r->'status','entries',r->'entries',
  'results',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('boatId',v->'boatId','status',v->'status','position',v->'position','finishedAt',v->'finishedAt'))),'[]'::jsonb) from jsonb_array_elements(r->'results') v))
  order by (r->>'order')::integer) from jsonb_array_elements(s.document->'races') r where r->>'status' in ('published','locked')))
 from public.series s where s.id=series_id and exists(select 1 from public.races where races.series_id=s.id and status in ('published','locked'));
$$;
revoke all on function public.public_series_directory() from public;
grant execute on function public.public_series_directory() to anon,authenticated;
