-- Managed through the Supabase dashboard; no client can grant itself access.
create table public.platform_admins(user_id uuid primary key references auth.users(id) on delete cascade);

create table public.series_access_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 note text not null check(length(trim(note)) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','approved','declined')),
 created_at timestamptz not null default now(), email_sent_at timestamptz, reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id)
);
alter table public.platform_admins enable row level security;
alter table public.series_creators enable row level security;
alter table public.series_access_requests enable row level security;
revoke all on public.platform_admins, public.series_creators, public.series_access_requests from anon, authenticated;
create function public.creation_access() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('admin',exists(select 1 from public.platform_admins where user_id=auth.uid()), 'allowed',exists(select 1 from public.platform_admins where user_id=auth.uid()) or exists(select 1 from public.series_creators where user_id=auth.uid()),'requestId',(select id from public.series_access_requests where user_id=auth.uid()),'emailSent',(select email_sent_at is not null from public.series_access_requests where user_id=auth.uid()),'status',(select status from public.series_access_requests where user_id=auth.uid()));
$$;
create function public.request_creation_access(reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and to_jsonb(u)->>'email_confirmed_at' is not null) then raise exception 'Verify your email before requesting access'; end if;
 insert into public.series_access_requests(user_id,note) values(auth.uid(),trim(reason));
end; $$;
create function public.review_creation_access(request_id uuid, approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid()) then raise exception 'Platform admin required'; end if;
 update public.series_access_requests set status=case when approve then 'approved' else 'declined' end,reviewed_at=now(),reviewed_by=auth.uid() where id=request_id and status='pending' returning user_id into target;
 if target is null then raise exception 'Request already reviewed or not found'; end if;
 if approve then insert into public.series_creators values(target) on conflict do nothing; end if;
end; $$;
create function public.list_creation_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.platform_admins where user_id=auth.uid()) then raise exception 'Platform admin required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'email',u.email,'note',r.note,'status',r.status) order by r.created_at) from public.series_access_requests r join auth.users u on u.id=r.user_id where r.status='pending'),'[]'::jsonb);
end; $$;
create or replace function public.can_create_series() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and ((public.creation_access()->>'allowed')::boolean);
$$;
revoke all on function public.creation_access(),public.request_creation_access(text),public.review_creation_access(uuid,boolean),public.list_creation_requests() from public;
grant execute on function public.creation_access(),public.request_creation_access(text),public.review_creation_access(uuid,boolean),public.list_creation_requests() to authenticated;
