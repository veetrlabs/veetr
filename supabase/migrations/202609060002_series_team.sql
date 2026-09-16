-- Only admins may resolve account email addresses or inspect their series roster.
create function public.series_team(series_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official(series_id,true) then raise exception 'Series admin required to manage the team'; end if;
 return (select coalesce(jsonb_agg(member order by member->>'role',member->>'email'),'[]'::jsonb) from (
  select jsonb_build_object('id',u.id,'email',u.email,'role','owner') member
   from public.series s join auth.users u on u.id=s.owner_id where s.id=series_id
  union all
  select jsonb_build_object('id',u.id,'email',u.email,'role',o.role)
   from public.race_officials o join auth.users u on u.id=o.user_id join public.series s on s.id=o.series_id
   where o.series_id=series_team.series_id and o.user_id<>s.owner_id
 ) roster);
end;
$$;
create function public.set_series_member(series_id uuid, member_email text, member_role text) returns void
language plpgsql security definer set search_path='' as $$
declare member_id uuid;
begin
 if not public.is_official(series_id,true) then raise exception 'Series admin required to manage the team'; end if;
 if member_role is null or member_role not in ('official','admin','remove') then raise exception 'Invalid team role'; end if;
 select id into member_id from auth.users where lower(email)=lower(btrim(member_email));
 if member_id is null then raise exception 'No account found. Ask this teammate to sign in once, then add their email here.'; end if;
 if exists(select 1 from public.series s where s.id=series_id and s.owner_id=member_id) then raise exception 'The series owner cannot be changed or removed'; end if;
 perform public.set_race_official(series_id,member_id,case when member_role='remove' then '' else member_role end);
end;
$$;
revoke all on function public.series_team(uuid),public.set_series_member(uuid,text,text) from public;
grant execute on function public.series_team(uuid),public.set_series_member(uuid,text,text) to authenticated;
