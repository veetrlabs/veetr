-- Series document is the atomic offline sync envelope. Relational projections below
-- preserve reusable boat identities and enforce entry/result integrity.
create table public.series (
 id uuid primary key, owner_id uuid not null references auth.users(id),
 name text not null check(length(name)>0), year integer not null check(year between 1900 and 2200),
 description text not null default '', status text not null check(status in ('draft','active','completed')),
 revision integer not null default 0, document jsonb not null,
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.race_officials (series_id uuid references public.series on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('official','admin')), primary key(series_id,user_id));
create table public.boats (id uuid primary key, owner_id uuid not null references auth.users, name text not null check(length(name)>0), sail_number text not null, skipper_name text, class_name text, length_m numeric check(length_m>0), updated_at timestamptz not null default now());
create table public.boat_members (boat_id uuid references public.boats, user_id uuid references auth.users, role text not null check(role in ('owner','crew')), primary key(boat_id,user_id));
create table public.race_categories (id uuid primary key, series_id uuid not null references public.series on delete cascade, name text not null check(length(name)>0), unique(id,series_id));
create table public.series_entries (series_id uuid references public.series on delete cascade, boat_id uuid references public.boats, category_id uuid not null, primary key(series_id,boat_id), foreign key(category_id,series_id) references public.race_categories(id,series_id));
create table public.races (id uuid primary key, series_id uuid not null references public.series on delete cascade, name text not null check(length(name)>0), race_date date not null, race_order integer not null check(race_order>0), weight numeric not null check(weight>0 and weight<=100), status text not null check(status in ('draft','published','locked')), unique(series_id,race_order) deferrable initially deferred,unique(id,series_id));
create table public.race_entries (race_id uuid, series_id uuid, boat_id uuid, primary key(race_id,boat_id), foreign key(race_id,series_id) references public.races(id,series_id) on delete cascade, foreign key(series_id,boat_id) references public.series_entries);
create table public.race_results (race_id uuid, boat_id uuid, category_id uuid not null references public.race_categories, status text not null check(status in ('FINISHED','DNS','DNF','DSQ','RET','OCS')), position integer, finished_at timestamptz, updated_at timestamptz not null default now(), updated_by uuid references auth.users, primary key(race_id,boat_id),foreign key(race_id,boat_id) references public.race_entries on delete cascade, check((status='FINISHED' and position is not null and position>0) or (status<>'FINISHED' and position is null)), unique(race_id,category_id,position));
create table public.series_changes (series_id uuid references public.series, mutation_id uuid, revision integer not null, actor_id uuid not null references auth.users, document jsonb not null, created_at timestamptz not null default now(), primary key(series_id,mutation_id));
create index race_officials_user_idx on public.race_officials(user_id);
create index boats_owner_idx on public.boats(owner_id);
create index series_owner_idx on public.series(owner_id);
create index race_categories_series_idx on public.race_categories(series_id);
create index race_entries_series_idx on public.race_entries(series_id);
create index series_entries_boat_idx on public.series_entries(boat_id);
create function public.is_official(sid uuid, admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.series where id=sid and owner_id=auth.uid()) or exists(select 1 from public.race_officials where series_id=sid and user_id=auth.uid() and (not admin_only or role='admin'));
$$;
alter table public.series enable row level security;
revoke all on public.series from anon, authenticated;
grant select on public.series to authenticated;
create policy official_read on public.series for select to authenticated using (public.is_official(id));
alter table public.race_officials enable row level security;
revoke all on public.race_officials from anon, authenticated;
grant select on public.race_officials to authenticated;
create policy official_read on public.race_officials for select to authenticated using (public.is_official(series_id));
alter table public.boats enable row level security;
revoke all on public.boats from anon, authenticated;
grant select on public.boats to authenticated;
create policy official_read on public.boats for select to authenticated using (owner_id=auth.uid() or exists(select 1 from public.series_entries e where e.boat_id=boats.id and public.is_official(e.series_id)));
alter table public.boat_members enable row level security;
revoke all on public.boat_members from anon, authenticated;
grant select on public.boat_members to authenticated;
create policy official_read on public.boat_members for select to authenticated using (user_id=auth.uid());
alter table public.race_categories enable row level security;
revoke all on public.race_categories from anon, authenticated;
grant select on public.race_categories to authenticated;
create policy official_read on public.race_categories for select to authenticated using (public.is_official(series_id));
alter table public.series_entries enable row level security;
revoke all on public.series_entries from anon, authenticated;
grant select on public.series_entries to authenticated;
create policy official_read on public.series_entries for select to authenticated using (public.is_official(series_id));
alter table public.races enable row level security;
revoke all on public.races from anon, authenticated;
grant select on public.races to authenticated;
create policy official_read on public.races for select to authenticated using (public.is_official(series_id));
alter table public.race_entries enable row level security;
revoke all on public.race_entries from anon, authenticated;
grant select on public.race_entries to authenticated;
create policy official_read on public.race_entries for select to authenticated using (public.is_official(series_id));
alter table public.race_results enable row level security;
revoke all on public.race_results from anon, authenticated;
grant select on public.race_results to authenticated;
create policy official_read on public.race_results for select to authenticated using (exists(select 1 from public.races r where r.id=race_id and public.is_official(r.series_id)));
alter table public.series_changes enable row level security;
revoke all on public.series_changes from anon, authenticated;
grant select on public.series_changes to authenticated;
create policy official_read on public.series_changes for select to authenticated using (public.is_official(series_id));
create function public.save_series(payload jsonb, expected_revision integer, mutation_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare sid uuid := (payload->>'id')::uuid; current_series public.series; item jsonb; boat jsonb; result jsonb; rid uuid; bid uuid; cid uuid; result_position integer; next_revision integer; old_race jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if mutation_id is null or expected_revision is null then raise exception 'Revision and mutation ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
 select * into current_series from public.series where id=sid for update;
 if current_series.id is not null and not public.is_official(sid) then raise exception 'Not a race official'; end if;
 select revision into next_revision from public.series_changes c where c.series_id=sid and c.mutation_id=save_series.mutation_id and c.actor_id=auth.uid();
 if found then return next_revision; end if;
 if coalesce(current_series.revision,0)<>expected_revision then raise exception 'SYNC_CONFLICT: server revision changed. Export local work and reload cloud copy.'; end if;
 if jsonb_typeof(payload->'categories') is distinct from 'array' or jsonb_typeof(payload->'boats') is distinct from 'array' or jsonb_typeof(payload->'races') is distinct from 'array' then raise exception 'Invalid series document'; end if;
 if jsonb_array_length(payload->'categories')=0 or (select count(distinct value->>'id') from jsonb_array_elements(payload->'categories'))<>jsonb_array_length(payload->'categories') or (select count(distinct value->>'id') from jsonb_array_elements(payload->'races'))<>jsonb_array_length(payload->'races') then raise exception 'Categories and races need unique IDs'; end if;
 -- Published race contents are immutable until an explicit save reopens them.
 for old_race in select value from jsonb_array_elements(coalesce(current_series.document->'races','[]')) loop
  if old_race->>'status' in ('published','locked') then
   select value into item from jsonb_array_elements(payload->'races') where value->>'id'=old_race->>'id';
   if item is null then raise exception 'Reopen race before removal'; end if;
   if old_race->>'status'='locked' and item is distinct from old_race and not public.is_official(sid,true) then raise exception 'Only a series admin can reopen a locked race'; end if;
   if (item-'status') is distinct from (old_race-'status') then raise exception 'Reopen race before editing'; end if;
  end if;
 end loop;
 if current_series.id is not null and (payload->'boats' is distinct from current_series.document->'boats' or payload->'categories' is distinct from current_series.document->'categories') and exists(select 1 from jsonb_array_elements(current_series.document->'races') r where r->>'status'<>'draft') then raise exception 'Reopen published races before changing the fleet'; end if;
 next_revision:=coalesce(current_series.revision,0)+1;
 insert into public.series(id,owner_id,name,year,description,status,revision,document,updated_by) values(sid,auth.uid(),payload->>'name',(payload->>'year')::integer,coalesce(payload->>'description',''),payload->>'status',next_revision,payload,auth.uid())
 on conflict(id) do update set name=excluded.name,year=excluded.year,description=excluded.description,status=excluded.status,revision=excluded.revision,document=excluded.document,updated_at=now(),updated_by=auth.uid();
 delete from public.race_results where race_id in (select id from public.races where series_id=sid);
 delete from public.race_entries where series_id=sid;
 delete from public.races where series_id=sid and id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'races'));
 delete from public.series_entries where series_id=sid;
 delete from public.race_categories where series_id=sid and id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'categories'));
 for item in select value from jsonb_array_elements(payload->'categories') loop
  if exists(select 1 from public.race_categories where id=(item->>'id')::uuid and series_id<>sid) then raise exception 'Category belongs to another series'; end if;
  insert into public.race_categories values((item->>'id')::uuid,sid,item->>'name') on conflict(id) do update set name=excluded.name;
 end loop;
 for boat in select value from jsonb_array_elements(payload->'boats') loop
  bid:=(boat->>'id')::uuid;
  if exists(select 1 from public.boats b where b.id=bid and b.owner_id<>auth.uid()) then
   -- Officials can reuse another owner's boat only if its public identity is unchanged.
   if not exists(select 1 from public.boats b where b.id=bid and b.name=boat->>'name' and b.sail_number=boat->>'sailNumber' and coalesce(b.skipper_name,'')=coalesce(boat->>'skipper','') and coalesce(b.class_name,'')=coalesce(boat->>'className','') and b.length_m is not distinct from (boat->>'length')::numeric) then raise exception 'Only the boat owner can change boat identity'; end if;
  else
   insert into public.boats(id,owner_id,name,sail_number,skipper_name,class_name,length_m) values(bid,auth.uid(),boat->>'name',boat->>'sailNumber',boat->>'skipper',boat->>'className',(boat->>'length')::numeric)
   on conflict(id) do update set name=excluded.name,sail_number=excluded.sail_number,skipper_name=excluded.skipper_name,class_name=excluded.class_name,length_m=excluded.length_m,updated_at=now();
  end if;
  insert into public.series_entries values(sid,bid,(boat->>'categoryId')::uuid);
 end loop;
 for item in select value from jsonb_array_elements(payload->'races') loop
  rid:=(item->>'id')::uuid;
  if exists(select 1 from public.races where id=rid and series_id<>sid) then raise exception 'Race belongs to another series'; end if;
  insert into public.races values(rid,sid,item->>'name',(item->>'date')::date,(item->>'order')::integer,(item->>'weight')::numeric,item->>'status') on conflict(id) do update set name=excluded.name,race_date=excluded.race_date,race_order=excluded.race_order,weight=excluded.weight,status=excluded.status;
  insert into public.race_entries select rid,sid,value::uuid from jsonb_array_elements_text(item->'entries');
  for result in select value from jsonb_array_elements(item->'results') loop
   bid:=(result->>'boatId')::uuid;
   select category_id into cid from public.series_entries where series_id=sid and boat_id=bid;
   result_position:=(result->>'position')::integer;
   if result_position>(select count(*) from public.race_entries e join public.series_entries s using(series_id,boat_id) where e.race_id=rid and s.category_id=cid) then raise exception 'Position exceeds category fleet'; end if;
   insert into public.race_results values(rid,bid,cid,result->>'status',result_position,(result->>'finishedAt')::timestamptz,now(),auth.uid());
  end loop;
  if item->>'status'<>'draft' and (select count(*) from public.race_results where race_id=rid)<>(select count(*) from public.race_entries where race_id=rid) then raise exception 'Every entry needs a result before publication'; end if;
 end loop;
 insert into public.series_changes(series_id,mutation_id,revision,actor_id,document) values(sid,mutation_id,next_revision,auth.uid(),payload);
 return next_revision;
end;
$$;
create function public.set_race_official(series_id uuid, official_id uuid, official_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_official(series_id,true) then raise exception 'Series admin required'; end if;
 if official_role is null or official_role='' then delete from public.race_officials o where o.series_id=set_race_official.series_id and user_id=official_id;
 else insert into public.race_officials values(series_id,official_id,official_role) on conflict on constraint race_officials_pkey do update set role=excluded.role; end if;
end;
$$;
create function public.public_standings(series_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'name',s.name,'year',s.year,'description',s.description,'status',s.status,'categories',s.document->'categories',
 'boats',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',b->'id','name',b->'name','sailNumber',b->'sailNumber','categoryId',b->'categoryId','className',b->'className','length',b->'length'))) from jsonb_array_elements(s.document->'boats') b where exists(select 1 from public.race_entries e join public.races r on r.id=e.race_id where e.boat_id=(b->>'id')::uuid and r.series_id=s.id and r.status in ('published','locked'))),'[]'::jsonb),
 'races',(select jsonb_agg(r order by (r->>'order')::integer) from jsonb_array_elements(s.document->'races') r where r->>'status' in ('published','locked')))
 from public.series s where s.id=series_id and exists(select 1 from public.races where races.series_id=s.id and status in ('published','locked'));
$$;
revoke all on function public.is_official(uuid,boolean), public.save_series(jsonb,integer,uuid), public.set_race_official(uuid,uuid,text), public.public_standings(uuid) from public;
grant execute on function public.is_official(uuid,boolean), public.save_series(jsonb,integer,uuid), public.set_race_official(uuid,uuid,text) to authenticated;
grant execute on function public.public_standings(uuid) to anon,authenticated;
