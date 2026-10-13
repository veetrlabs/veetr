-- Public catalog only: never import owner details, addresses or boat names.
create table public.boat_catalog_source (
  singleton boolean primary key default true check(singleton),
  revision text not null, year integer not null, source_url text not null,
  sha256 text not null, imported_at timestamptz not null default now(), row_count integer not null
);
create table public.boat_catalog (
  id text primary key, model_key text not null, model text not null,
  manufacturer text not null, configuration text not null, year integer,
  length_m double precision not null check(length_m>0 and length_m<=200),
  draft_m double precision not null check(draft_m>0 and draft_m<=30),
  beam_m double precision not null check(beam_m>0 and beam_m<=100),
  displacement_kg double precision, main_m2 double precision, genoa_m2 double precision,
  spinnaker_m2 double precision, asymmetric_m2 double precision,
  points jsonb not null check(jsonb_typeof(points)='array' and jsonb_array_length(points)>=16)
);
create index boat_catalog_model on public.boat_catalog(model_key,id);
alter table public.boat_catalog enable row level security;
alter table public.boat_catalog_source enable row level security;
create policy catalog_read on public.boat_catalog for select to anon,authenticated using(true);
create policy catalog_source_read on public.boat_catalog_source for select to anon,authenticated using(true);
revoke all on public.boat_catalog,public.boat_catalog_source from public,anon,authenticated;
grant select on public.boat_catalog,public.boat_catalog_source to anon,authenticated;
grant all on public.boat_catalog,public.boat_catalog_source to service_role;
-- Supabase service_role bypasses RLS; ordinary clients can only read public specifications.
create table public.boat_catalog_staging (
  run_id uuid not null, id text not null, row_data jsonb not null,
  staged_at timestamptz not null default now(), primary key(run_id,id)
);
alter table public.boat_catalog_staging enable row level security;
revoke all on public.boat_catalog_staging from public,anon,authenticated;
grant all on public.boat_catalog_staging to service_role;
create function public.stage_boat_catalog(p_run_id uuid,p_rows jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
begin
  if jsonb_array_length(p_rows)>100 then raise exception 'Batch too large';end if;
  delete from public.boat_catalog_staging where staged_at<now()-interval '1 day';
  insert into public.boat_catalog_staging(run_id,id,row_data)
  select p_run_id,r->>'id',r from jsonb_array_elements(p_rows) r
  on conflict(run_id,id) do update set row_data=excluded.row_data;
  return jsonb_array_length(p_rows);
end $$;
revoke all on function public.stage_boat_catalog(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.stage_boat_catalog(uuid,jsonb) to service_role;
create function public.install_boat_catalog(p_run_id uuid,p_revision text,p_year integer,p_source_url text,p_sha256 text)
returns integer language plpgsql security invoker set search_path='' as $$
declare n integer; previous integer;
begin
  perform pg_advisory_xact_lock(84723519);
  select count(*) into n from public.boat_catalog_staging where run_id=p_run_id;
  select row_count into previous from public.boat_catalog_source where singleton;
  if n<1000 or n>30000 or n<coalesce(previous,0)*0.75 then
    raise exception 'Incomplete catalog; existing catalog was not changed';
  end if;
  if p_revision !~ '^[a-f0-9]{40}$' or p_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Invalid source identity'; end if;
  delete from public.boat_catalog where id is not null;
  insert into public.boat_catalog select c.* from public.boat_catalog_staging s
    cross join lateral jsonb_populate_record(null::public.boat_catalog,s.row_data) c where s.run_id=p_run_id;
  insert into public.boat_catalog_source(singleton,revision,year,source_url,sha256,row_count)
  values(true,p_revision,p_year,p_source_url,p_sha256,n)
  on conflict(singleton) do update set revision=excluded.revision,year=excluded.year,source_url=excluded.source_url,
    sha256=excluded.sha256,row_count=excluded.row_count,imported_at=now();
  delete from public.boat_catalog_staging where run_id=p_run_id;
  return n;
end $$;
revoke all on function public.install_boat_catalog(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.install_boat_catalog(uuid,text,integer,text,text) to service_role;

-- Bounded model lookup. Whitespace-separated words match punctuation-insensitively,
-- e.g. "J24", "J/24", and "Beneteau 36.7"; values never become SQL patterns.
create function public.search_boat_catalog(p_query text)
returns table(model_key text,model text,manufacturer text,configurations bigint)
language sql stable security invoker set search_path='' as $$
  select c.model_key,min(c.model),min(c.manufacturer),count(*)
  from public.boat_catalog c
  where length(trim(p_query)) between 2 and 100
    and regexp_replace(lower(p_query),'[^a-z0-9]','','g')<>''
    and not exists (
      select 1 from regexp_split_to_table(lower(trim(p_query)),'\s+') term
      where position(regexp_replace(term,'[^a-z0-9]','','g') in
        regexp_replace(lower(c.manufacturer||' '||c.model),'[^a-z0-9]','','g'))=0
    )
  group by c.model_key order by min(c.model),c.model_key limit 30
$$;
revoke all on function public.search_boat_catalog(text) from public;
grant execute on function public.search_boat_catalog(text) to anon,authenticated,service_role;
-- Detail and source metadata share one database snapshot during concurrent imports.
create function public.boat_catalog_detail(p_id text,p_revision text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(c)||jsonb_build_object('revision',s.revision,'source_url',s.source_url,'source_year',s.year)
 from public.boat_catalog c cross join public.boat_catalog_source s
 where c.id=p_id and s.revision=p_revision
$$;
revoke all on function public.boat_catalog_detail(text,text) from public;
grant execute on function public.boat_catalog_detail(text,text) to anon,authenticated,service_role;
create function public.boat_catalog_configurations(p_model_key text,p_offset integer default 0)
returns table(id text,configuration text,year integer,draft_m double precision,main_m2 double precision,
  genoa_m2 double precision,spinnaker_m2 double precision,asymmetric_m2 double precision,revision text)
language sql stable security invoker set search_path='' as $$
 select c.id,c.configuration,c.year,c.draft_m,c.main_m2,c.genoa_m2,c.spinnaker_m2,c.asymmetric_m2,s.revision
 from public.boat_catalog c cross join public.boat_catalog_source s
 where c.model_key=p_model_key order by c.configuration,c.id limit 30 offset greatest(0,least(p_offset,30000))
$$;
revoke all on function public.boat_catalog_configurations(text,integer) from public;
grant execute on function public.boat_catalog_configurations(text,integer) to anon,authenticated,service_role;
