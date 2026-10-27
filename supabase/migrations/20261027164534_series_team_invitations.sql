-- Series invitations are bearer links: recipients explicitly choose their account.
create table public.series_team_invitations (
 id uuid primary key default gen_random_uuid(),
 series_id uuid not null references public.series on delete cascade,
 email text not null,
 role text not null check(role in ('official','admin')),
 language text not null check(language in ('en','cs')),
 message text not null default '' check(length(message)<=2000),
 token text not null unique default (gen_random_uuid()::text || gen_random_uuid()::text),
 created_by uuid not null references auth.users on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,
 accepted_at timestamptz,
 accepted_by uuid references auth.users on delete set null,
 email_attempt_at timestamptz,
 email_attempts integer not null default 0,
 email_sent_at timestamptz
);
create index series_team_invitation_series on public.series_team_invitations(series_id,created_at);
alter table public.series_team_invitations enable row level security;
revoke all on public.series_team_invitations from public,anon,authenticated;

create function private.series_inviter_allowed(sid uuid, uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.account_security where user_id=uid and suspended)
 and (exists(select 1 from public.series where id=sid and owner_id=uid)
 or exists(select 1 from public.race_officials where series_id=sid and user_id=uid and role='admin')
 or exists(select 1 from public.platform_admins where user_id=uid));
$$;
revoke all on function private.series_inviter_allowed(uuid,uuid) from public,anon,authenticated;

create function public.series_teammate_exists(sid uuid, recipient text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official(sid,true) then raise exception 'Series admin required to manage the team'; end if;
 return exists(select 1 from auth.users where lower(email)=lower(btrim(recipient)));
end $$;

create function public.invite_series_teammate(sid uuid, recipient text, member_role text, email_language text, custom_message text) returns uuid
language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(btrim(recipient)); invitation uuid;
begin
 if not public.is_official(sid,true) then raise exception 'Series admin required to manage the team'; end if;
 perform 1 from public.series where id=sid for update;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid email required'; end if;
 if member_role is null or member_role not in ('official','admin') or email_language is null or email_language not in ('en','cs') or custom_message is null or length(custom_message)>2000 then raise exception 'Invalid invitation'; end if;
 if exists(select 1 from public.series_team_invitations where series_id=sid and email=normalized and created_at>now()-interval '60 seconds') then raise exception 'Wait a minute before resending'; end if;
 if (select count(*) from public.series_team_invitations where series_id=sid and created_at>now()-interval '1 day')>=50 then raise exception 'Daily invitation limit reached'; end if;
 update public.series_team_invitations set revoked_at=now() where series_id=sid and email=normalized and accepted_at is null and revoked_at is null;
 insert into public.series_team_invitations(series_id,email,role,language,message,created_by)
 values(sid,normalized,member_role,email_language,btrim(custom_message),auth.uid()) returning id into invitation;
 return invitation;
end $$;

create function public.series_team_invitations(sid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official(sid,true) then raise exception 'Series admin required to manage the team'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'sent',i.email_sent_at is not null,
 'status',case when i.revoked_at is not null then 'revoked' when i.accepted_at is not null then 'accepted' when i.expires_at<=now() then 'expired' else 'pending' end,
 'acceptedEmail',u.email) order by i.created_at desc)
 from public.series_team_invitations i left join auth.users u on u.id=i.accepted_by where i.series_id=sid),'[]'::jsonb);
end $$;

create function public.revoke_series_team_invitation(invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare i public.series_team_invitations;
begin
 select * into i from public.series_team_invitations where id=invitation_id for update;
 if not found or not public.is_official(i.series_id,true) then raise exception 'Series admin required to manage the team'; end if;
 update public.series_team_invitations set revoked_at=now() where id=i.id and accepted_at is null;
end $$;

create function public.series_team_invitation_preview(invite_token text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('series',s.document->>'name','role',i.role,'message',i.message,'expiresAt',i.expires_at,
 'status',case when i.revoked_at is not null or not private.series_inviter_allowed(i.series_id,i.created_by) then 'revoked'
 when i.accepted_at is not null then 'accepted' when i.expires_at<=now() then 'expired' else 'pending' end)
 from public.series_team_invitations i join public.series s on s.id=i.series_id where i.token=invite_token;
$$;

create function public.accept_series_team_invitation(invite_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.series_team_invitations;
begin
 perform public.require_active_account();
 if not exists(select 1 from auth.users u where u.id=auth.uid() and to_jsonb(u)->>'email_confirmed_at' is not null) then raise exception 'Verify your email before accepting this invitation'; end if;
 select * into i from public.series_team_invitations where token=invite_token for update;
 if not found or i.revoked_at is not null then raise exception 'Invitation unavailable'; end if;
 if i.accepted_by=auth.uid() then return i.series_id; end if;
 if i.accepted_at is not null or i.expires_at<=now() then raise exception 'Invitation expired or already accepted'; end if;
 if not private.series_inviter_allowed(i.series_id,i.created_by) then raise exception 'Ask a series manager for a new invitation'; end if;
 -- Preserve an existing manager role and never change the owner.
 if not exists(select 1 from public.series where id=i.series_id and owner_id=auth.uid()) then
 insert into public.race_officials(series_id,user_id,role) values(i.series_id,auth.uid(),i.role)
 on conflict(series_id,user_id) do update set role=case when race_officials.role='admin' then 'admin' else excluded.role end;
 end if;
 update public.series_team_invitations set accepted_by=auth.uid(),accepted_at=now() where id=i.id;
 return i.series_id;
end $$;

create function public.prepare_series_team_invitation_email(invitation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.series_team_invitations;
begin
 select * into i from public.series_team_invitations where id=invitation_id for update;
 if not found or not public.is_official(i.series_id,true) then raise exception 'Series admin required to manage the team'; end if;
 if i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now() or not private.series_inviter_allowed(i.series_id,i.created_by) then raise exception 'Invitation unavailable'; end if;
 if i.email_attempts>=10 then raise exception 'Email retry limit reached. Create a new invitation'; end if;
 if i.email_attempt_at>now()-interval '60 seconds' then raise exception 'Wait a minute before retrying email'; end if;
 update public.series_team_invitations set email_attempt_at=now(),email_attempts=email_attempts+1 where id=i.id;
 return jsonb_build_object('deliveryKey',i.id::text || '/' || (i.email_attempts+1)::text,'email',i.email,'token',i.token,'role',i.role,'language',i.language,'message',i.message,'series',(select document->>'name' from public.series where id=i.series_id));
end $$;
create function public.mark_series_team_invitation_sent(invitation_id uuid) returns void
language sql security definer set search_path='' as $$
 update public.series_team_invitations set email_sent_at=now() where id=invitation_id;
$$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('series_teammate_exists','invite_series_teammate','series_team_invitations','revoke_series_team_invitation','series_team_invitation_preview','accept_series_team_invitation','prepare_series_team_invitation_email','mark_series_team_invitation_sent') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if f.proname='mark_series_team_invitation_sent' then execute format('grant execute on function %s to service_role',f.signature);
 else execute format('grant execute on function %s to authenticated',f.signature); end if;
 if f.proname='series_team_invitation_preview' then execute format('grant execute on function %s to anon',f.signature); end if;
 end loop;
end $$;

-- Direct membership changes supersede pending invitations for the same address.
do $$ declare definition text; begin
 select pg_get_functiondef('public.set_series_member(uuid,text,text)'::regprocedure) into definition;
 definition:=replace(definition,
 'perform public.set_race_official(series_id,member_id,case when member_role=''remove'' then '''' else member_role end);',
 'perform public.set_race_official(series_id,member_id,case when member_role=''remove'' then '''' else member_role end);
 update public.series_team_invitations i set revoked_at=now() where i.series_id=set_series_member.series_id and i.email=lower(btrim(member_email)) and i.accepted_at is null and i.revoked_at is null;');
 execute definition;
end $$;
