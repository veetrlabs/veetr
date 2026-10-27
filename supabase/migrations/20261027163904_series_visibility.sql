-- Visibility is independent of legacy lifecycle status so installed clients
-- can still read and save series. Missing visibility maps old states safely.
create function private.series_visibility(document jsonb, status text) returns text
language sql immutable set search_path='' as $$
 select coalesce(document->>'visibility',case when status='draft' then 'draft' else 'public' end);
$$;
revoke all on function private.series_visibility(jsonb,text) from public,anon,authenticated;

alter table public.series add constraint series_visibility_valid check (
 not (document ? 'visibility') or (
 jsonb_typeof(document->'visibility')='string'
 and document->>'visibility' in ('public','unlisted','draft')
 and ((status='draft')=(document->>'visibility'='draft'))));


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
 -- Old clients omit visibility. Never relist an unlisted series on their saves.
 if not (payload ? 'visibility') and previous ? 'visibility' then
  payload:=jsonb_set(payload,'{visibility}',to_jsonb(case
   when payload->>'status'='draft' then 'draft'
   when previous->>'visibility'='unlisted' then 'unlisted'
   else 'public' end));
 end if;
 if previous is not null and public.is_official((payload->>'id')::uuid) and not public.is_official((payload->>'id')::uuid,true) then
  if (payload-'races'-'courses') is distinct from (previous-'races'-'courses') then raise exception 'Series manager required to change series settings'; end if;
  if (select coalesce(jsonb_agg(r-'results'-'entries'-'status' order by r->>'id'),'[]'::jsonb) from jsonb_array_elements(payload->'races') r)
    is distinct from (select coalesce(jsonb_agg(r-'results'-'entries'-'status' order by r->>'id'),'[]'::jsonb) from jsonb_array_elements(previous->'races') r) then
   raise exception 'Series manager required to change heat settings';
  end if;
 end if;
 return public.save_series_snapshot(payload,expected_revision,mutation_id);
end; $$;

create or replace function private.require_public_series(sid uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.series s where s.id=sid
   and private.series_visibility(s.document,s.status) in ('public','unlisted')
   and exists(select 1 from public.races r where r.series_id=s.id and r.status in ('published','locked'))) then
  raise sqlstate 'PT404' using message='Not found';
 end if;
end;
$$;

create or replace function public.public_series_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by (item->>'year')::integer desc,item->>'name'),'[]'::jsonb)
 from (
  select jsonb_build_object('id',s.id,'name',s.name,'year',s.year,'description',s.description,'status',s.status,'visibility','public',
   'raceCount',(select count(*) from public.races r where r.series_id=s.id and r.status in ('published','locked')),
   'boatCount',(select count(distinct e.boat_id) from public.race_entries e join public.races r on r.id=e.race_id where r.series_id=s.id and r.status in ('published','locked'))) item
  from public.series s where private.series_visibility(s.document,s.status)='public' and exists(select 1 from public.races r where r.series_id=s.id and r.status in ('published','locked'))
 ) published;
$$;

create or replace function public.boat_results(boat_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.public_standings(s.id) order by s.year desc,s.name),'[]'::jsonb)
 from public.series s where private.series_visibility(s.document,s.status)='public' and exists(select 1 from public.races r join public.race_entries e on e.race_id=r.id where r.series_id=s.id and e.boat_id=boat_results.boat_id and r.status in ('published','locked'));
$$;

create or replace function public.public_standings(series_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_public_series(series_id);
 return (
select jsonb_strip_nulls(jsonb_build_object('id',s.id,'name',s.name,'year',s.year,'description',s.description,'status',s.status,'visibility',private.series_visibility(s.document,s.status),'categories',s.document->'categories',
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
 from public.series s where s.id=public_standings.series_id and exists(select 1 from public.races where races.series_id=s.id and status in ('published','locked'))
 );
end;
$$;

-- Resolve only the exact link supplied by the viewer. Unlisted slugs must
-- never be added to public_entity_routes or any directory response.
create function public.public_series_by_route(series_route text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare sid uuid;
begin
 select id into sid from public.series where slug=series_route or id::text=series_route limit 1;
 perform private.require_public_series(sid);
 return public.public_standings(sid);
end;
$$;
revoke all on function public.public_series_by_route(text) from public;
grant execute on function public.public_series_by_route(text) to anon,authenticated;
