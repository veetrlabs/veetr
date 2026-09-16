-- Public boat identities are independent of series; personal/contact data stay private.
create or replace function public.boat_directory() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'name',name,'className',class_name,'length',length_m)) order by name,id),'[]'::jsonb) from public.boats;
$$;
create or replace function public.boat_results(boat_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.public_standings(s.id) order by s.year desc,s.name),'[]'::jsonb)
 from public.series s where exists(select 1 from public.races r join public.race_entries e on e.race_id=r.id where r.series_id=s.id and e.boat_id=boat_results.boat_id and r.status in ('published','locked'));
$$;
create or replace function public.create_boat(boat_id uuid, boat_name text, boat_class text, boat_length numeric default null) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(trim(boat_name))=0 then raise exception 'Boat name required'; end if;
 insert into public.boats(id,owner_id,name,sail_number,class_name,length_m) values(boat_id,auth.uid(),trim(boat_name),'',coalesce(boat_class,''),boat_length);
 return boat_id;
end;
$$;
revoke all on function public.boat_directory(),public.boat_results(uuid),public.create_boat(uuid,text,text,numeric) from public;
grant execute on function public.boat_directory(),public.boat_results(uuid) to anon,authenticated;
grant execute on function public.create_boat(uuid,text,text,numeric) to authenticated;

create or replace function public.save_series(payload jsonb, expected_revision integer, mutation_id uuid) returns integer language plpgsql security definer set search_path='' as $$
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
 -- Use canonical identities for existing boats; series clients only assign categories.
 payload:=jsonb_set(payload,'{boats}',(select coalesce(jsonb_agg(case when b.id is null then v else jsonb_strip_nulls(v || jsonb_build_object('name',b.name,'sailNumber',b.sail_number,'skipper',coalesce(b.skipper_name,''),'className',coalesce(b.class_name,''),'length',b.length_m)) end),'[]'::jsonb) from jsonb_array_elements(payload->'boats') v left join public.boats b on b.id=(v->>'id')::uuid));
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
 end loop;
 insert into public.series_changes(series_id,mutation_id,revision,actor_id,document) values(sid,mutation_id,next_revision,auth.uid(),payload);
 return next_revision;
end;
$$;
