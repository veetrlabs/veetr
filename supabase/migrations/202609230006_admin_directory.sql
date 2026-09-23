-- One searchable directory, while invitations remain distinct from authenticated accounts.
create function public.admin_directory(search_text text default '', page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 if page_offset < 0 or length(search_text)>200 then raise exception 'Invalid search'; end if;
 return coalesce((select jsonb_agg(to_jsonb(d) order by lower(d.email),d.id) from (
 with pending as (
  select lower(trim(i.email)) email_key,jsonb_agg(jsonb_build_object(
   'id',i.id,'series_id',i.series_id,'boat_name',b.name,'series_name',s.name) order by i.created_at,i.id) invitations
  from public.boat_invitations i join public.series s on s.id=i.series_id join public.boats b on b.id=i.boat_id
  where i.accepted_at is null and i.revoked_at is null and i.expires_at>now()
  group by lower(trim(i.email))
 ), people as (
  select u.id,u.email,exists(select 1 from public.platform_admins a where a.user_id=u.id) admin,
   coalesce(sec.suspended,false) suspended,coalesce(p.invitations,'[]'::jsonb) invitations
  from auth.users u left join public.account_security sec on sec.user_id=u.id
  left join pending p on p.email_key=lower(trim(u.email))
  union all
  select null::uuid,p.email_key,false,false,p.invitations from pending p
  where not exists(select 1 from auth.users u where lower(trim(u.email))=p.email_key)
 )
 select * from people where strpos(lower(coalesce(email,'')),lower(search_text))>0
 order by lower(email),id limit 50 offset page_offset
 ) d),'[]'::jsonb);
end $$;
revoke all on function public.admin_directory(text,integer) from public,anon,authenticated;
grant execute on function public.admin_directory(text,integer) to authenticated;
notify pgrst, 'reload schema';
