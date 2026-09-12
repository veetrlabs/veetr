-- Creation approval is separate from ownership of an existing series.
create table public.series_creators (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.series_creators enable row level security;
revoke all on public.series_creators from anon, authenticated;
-- Existing organizers keep their ability to create series.
insert into public.series_creators select distinct owner_id from public.series on conflict do nothing;
create function public.can_create_series() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.series_creators where user_id=auth.uid());
$$;
create function public.require_series_creator() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- save_series uses INSERT ... ON CONFLICT for updates, which also runs this trigger.
 if auth.uid() is not null and not exists(select 1 from public.series where id=new.id)
    and not public.can_create_series() then raise exception 'Organizer approval required to create a series'; end if;
 return new;
end $$;
create trigger require_series_creator before insert on public.series for each row execute function public.require_series_creator();
revoke all on function public.require_series_creator(),public.can_create_series() from public;
grant execute on function public.can_create_series() to authenticated;

-- Only a boat owner can share or delete its profile. Crew membership alone is not editing access.
alter table public.boat_members drop constraint boat_members_role_check;
alter table public.boat_members add constraint boat_members_role_check check(role in ('owner','crew','editor'));
create function public.can_manage_boat(boat_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.boats b where b.id=boat_id and b.owner_id=auth.uid());
$$;
create or replace function public.can_edit_boat(boat_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.can_manage_boat(boat_id) or (auth.uid() is not null and exists(
  select 1 from public.boat_members m where m.boat_id=can_edit_boat.boat_id and m.user_id=auth.uid() and m.role='editor'
 ));
$$;
create function public.boat_team(boat_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_manage_boat(boat_id) then raise exception 'Boat owner required'; end if;
 return (select coalesce(jsonb_agg(member order by member->>'role',member->>'email'),'[]'::jsonb) from (
  select jsonb_build_object('id',u.id,'email',u.email,'role','owner') member from public.boats b join auth.users u on u.id=b.owner_id where b.id=boat_id
  union all
  select jsonb_build_object('id',u.id,'email',u.email,'role',m.role) from public.boat_members m join auth.users u on u.id=m.user_id join public.boats b on b.id=m.boat_id where m.boat_id=boat_team.boat_id and m.user_id<>b.owner_id
 ) roster);
end $$;
create function public.set_boat_member(boat_id uuid,member_email text,member_role text) returns void language plpgsql security definer set search_path='' as $$
declare member_id uuid;
begin
 perform 1 from public.boats b where b.id=boat_id for update;
 if not public.can_manage_boat(boat_id) then raise exception 'Boat owner required'; end if;
 if member_role is null or member_role not in ('editor','remove') then raise exception 'Invalid boat role'; end if;
 select id into member_id from auth.users where lower(email)=lower(btrim(member_email));
 if member_id is null then raise exception 'No account found. Ask this teammate to sign in once, then add their email here.'; end if;
 if exists(select 1 from public.boats b where b.id=boat_id and b.owner_id=member_id) then raise exception 'The boat owner cannot be changed or removed'; end if;
 if member_role='remove' then delete from public.boat_members m where m.boat_id=set_boat_member.boat_id and user_id=member_id;
 else insert into public.boat_members values(boat_id,member_id,'editor') on conflict on constraint boat_members_pkey do update set role='editor'; end if;
end $$;
revoke all on function public.can_manage_boat(uuid),public.boat_team(uuid),public.set_boat_member(uuid,text,text) from public;
grant execute on function public.can_manage_boat(uuid),public.boat_team(uuid),public.set_boat_member(uuid,text,text) to authenticated;

create or replace function public.update_boat(boat_id uuid, boat_name text, boat_class text, boat_length numeric, expected jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b public.boats; s public.series; updated_document jsonb;
begin
 select * into b from public.boats where id=boat_id for update;
 if not public.can_edit_boat(boat_id) then raise exception 'Boat owner or editor required'; end if;
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

create or replace function public.delete_boat(boat_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.boats where id=boat_id for update;
 if not public.can_manage_boat(boat_id) then raise exception 'Boat owner required'; end if;
 if exists(select 1 from public.series_entries where series_entries.boat_id=delete_boat.boat_id) then raise exception 'Remove this boat from all series before deleting its profile'; end if;
 delete from public.boat_members where boat_members.boat_id=delete_boat.boat_id;
 delete from public.boats where id=boat_id;
end $$;
