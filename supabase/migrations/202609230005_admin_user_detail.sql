-- Direct user lookup for dedicated editor URLs, with the same MFA gate as the directory.
create function public.admin_user(target_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 return (
 select jsonb_build_object('id',u.id,'email',u.email,'verified',to_jsonb(u)->>'email_confirmed_at' is not null,
 'admin',exists(select 1 from public.platform_admins a where a.user_id=u.id),
 'suspended',coalesce(sec.suspended,false),
 'seriesCreator',exists(select 1 from public.series_creators c where c.user_id=u.id),
 'roles',coalesce((select jsonb_agg(x) from (
 select jsonb_build_object('scope','series','id',s.id,'name',s.name,'role','owner') x from public.series s where s.owner_id=u.id
 union all select jsonb_build_object('scope','series','id',s.id,'name',s.name,'role',case o.role when 'admin' then 'manager' else 'referee' end) from public.race_officials o join public.series s on s.id=o.series_id where o.user_id=u.id and s.owner_id<>u.id
 union all select jsonb_build_object('scope','boat','id',b.id,'name',b.name,'role','owner') from public.boats b where b.owner_id=u.id
 union all select jsonb_build_object('scope','boat','id',b.id,'name',b.name,'role',m.role) from public.boat_members m join public.boats b on b.id=m.boat_id where m.user_id=u.id and b.owner_id<>u.id
 ) roles),'[]'::jsonb))
 from auth.users u left join public.account_security sec on sec.user_id=u.id
 where u.id=target_user
);
end $$;
revoke all on function public.admin_user(uuid) from public,anon,authenticated;
grant execute on function public.admin_user(uuid) to authenticated;
