create function public.can_edit_boat(boat_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.boats b where b.id=boat_id and (b.owner_id=auth.uid() or exists(select 1 from public.series_entries e where e.boat_id=b.id and public.is_official(e.series_id,true))));
$$;
create function public.update_boat(boat_id uuid, boat_name text, boat_class text, boat_length numeric, expected jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b public.boats; s public.series; updated_document jsonb;
begin
 if not public.can_edit_boat(boat_id) then raise exception 'Boat owner or series admin required'; end if;
 select * into b from public.boats where id=boat_id for update;
 if jsonb_strip_nulls(jsonb_build_object('id',b.id,'name',b.name,'className',b.class_name,'length',b.length_m)) is distinct from expected then raise exception 'Boat changed elsewhere. Cancel and reopen the editor to load the latest details.'; end if;
 if boat_name is null or length(trim(boat_name))=0 then raise exception 'Boat name required'; end if;
 update public.boats set name=trim(boat_name),class_name=coalesce(boat_class,''),length_m=boat_length,updated_at=now() where id=boat_id;
 -- Keep series snapshots and revision checks consistent with the registry edit.
 for s in select * from public.series where id in (select series_id from public.series_entries where series_entries.boat_id=update_boat.boat_id) order by id for update loop
  updated_document:=jsonb_set(s.document,'{boats}',(select jsonb_agg(case when v->>'id'=boat_id::text then jsonb_strip_nulls(v || jsonb_build_object('name',trim(boat_name),'className',coalesce(boat_class,''),'length',boat_length)) else v end) from jsonb_array_elements(s.document->'boats') v));
  update public.series set document=updated_document,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=s.id;
  insert into public.series_changes(series_id,mutation_id,revision,actor_id,document) values(s.id,gen_random_uuid(),s.revision+1,auth.uid(),updated_document);
 end loop;
end;
$$;
revoke all on function public.can_edit_boat(uuid),public.update_boat(uuid,text,text,numeric,jsonb) from public;
grant execute on function public.can_edit_boat(uuid),public.update_boat(uuid,text,text,numeric,jsonb) to authenticated;
