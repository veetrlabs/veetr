-- Omit absent optional fields so anonymous standings match the Series contract.
-- Preserve the existing published-heat and crew-privacy filters.
create or replace function public.public_standings(series_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('id',s.id,'name',s.name,'year',s.year,'description',s.description,'status',s.status,'categories',s.document->'categories',
 'pointsStart',s.document->'pointsStart',
 'discards',coalesce((select jsonb_agg(jsonb_build_object('from',d->'from','discard',d->'discard')) from jsonb_array_elements(s.document->'discards') d),'[]'::jsonb),
 'events',case when s.document ? 'events' then (select coalesce(jsonb_agg(jsonb_build_object('id',e->'id','name',e->'name','order',e->'order','weight',e->'weight','completed',e->'completed','countAs',e->'countAs','discards',coalesce((select jsonb_agg(jsonb_build_object('from',d->'from','discard',d->'discard')) from jsonb_array_elements(e->'discards') d),'[]'::jsonb))),'[]'::jsonb) from jsonb_array_elements(s.document->'events') e where exists(select 1 from jsonb_array_elements(s.document->'races') r where r->>'eventId'=e->>'id' and r->>'status' in ('published','locked'))) else null end,
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
