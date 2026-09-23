-- Boat-wide team invitations and series skipper invitations share one delivery flow.
alter table public.boat_invitations alter column series_id drop not null;
alter table public.boat_invitations add column member_role text not null default 'skipper'
 check(member_role in ('manager','crew','skipper'));
alter table public.boat_invitations add constraint boat_invitation_scope_role check(
 (series_id is null and member_role in ('manager','crew')) or (series_id is not null and member_role='skipper'));
create unique index boat_team_invitation_pending on public.boat_invitations(boat_id,email) where series_id is null and accepted_at is null and revoked_at is null;

create function public.grant_or_invite_boat_access(bid uuid, recipient text, member_role text, sid uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(btrim(recipient)); target uuid; i public.boat_invitations;
begin
 perform public.require_active_account();
 if sid is null then
  perform 1 from public.boats where id=bid for update;
  if not public.can_manage_boat(bid) then raise exception 'Boat manager required'; end if;
  if member_role not in ('manager','crew') or member_role is null then raise exception 'Invalid boat role'; end if;
 else
  perform 1 from public.series where id=sid for update;
  if not public.is_official(sid) then raise exception 'Race official required'; end if;
  if member_role is distinct from 'skipper' then raise exception 'Invalid series role'; end if;
  if not exists(select 1 from public.series_entries where series_id=sid and boat_id=bid) then raise exception 'Boat is not entered in this series'; end if;
 end if;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid email required'; end if;
 if exists(select 1 from public.boat_invitations where boat_id=bid and series_id is not distinct from sid and email=normalized and created_at>now()-interval '60 seconds' and revoked_at is null) then raise exception 'Wait a minute before resending'; end if;
 select id into target from auth.users u where lower(u.email)=normalized and to_jsonb(u)->>'email_confirmed_at' is not null;
 if target is not null then
  if exists(select 1 from public.account_security where user_id=target and suspended) then raise exception 'Restore the account before granting access'; end if;
  if sid is null then perform public.set_boat_member(bid,normalized,member_role);
  else insert into public.boat_series_members(series_id,boat_id,user_id,role) values(sid,bid,target,'skipper') on conflict(series_id,boat_id,user_id) do update set role='skipper'; end if;
 end if;
 update public.boat_invitations set revoked_at=now() where boat_id=bid and series_id is not distinct from sid and email=normalized and accepted_at is null and revoked_at is null;
 insert into public.boat_invitations(series_id,boat_id,email,created_by,member_role,accepted_by,accepted_at)
 values(sid,bid,normalized,auth.uid(),member_role,target,case when target is not null then now() end) returning * into i;
 return jsonb_build_object('id',i.id,'token',i.token,'status',case when target is null then 'pending' else 'granted' end);
end $$;

create function public.boat_team_invitations(bid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_manage_boat(bid) then raise exception 'Boat manager required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'role',member_role,'sent',email_sent_at is not null,'status',case when accepted_at is null then 'pending' else 'granted' end) order by created_at desc)
 from public.boat_invitations where boat_id=bid and series_id is null and revoked_at is null and (expires_at>now() or accepted_at is not null)),'[]'::jsonb);
end $$;

create function public.revoke_boat_team_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations;
begin
 select * into i from public.boat_invitations where id=invitation_id for update;
 if i.series_id is not null or not public.can_manage_boat(i.boat_id) then raise exception 'Boat manager required'; end if;
 update public.boat_invitations set revoked_at=now() where id=i.id and accepted_at is null;
end $$;

create or replace function public.boat_invitation_preview(invite_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('boat',b.name,'series',s.name,'role',i.member_role,'status',case when i.revoked_at is not null then 'revoked' when i.accepted_at is not null then 'accepted' when i.expires_at<=now() then 'expired' else 'pending' end)
 from public.boat_invitations i join public.boats b on b.id=i.boat_id left join public.series s on s.id=i.series_id where i.token=invite_token;
$$;

create or replace function public.accept_boat_invitation(invite_token uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations;
begin
 perform public.require_active_account();
 select * into i from public.boat_invitations where token=invite_token;
 if i.series_id is null then perform 1 from public.boats where id=i.boat_id for update;
 else perform 1 from public.series where id=i.series_id for update; end if;
 select * into i from public.boat_invitations where token=invite_token for update;
 if not found or i.revoked_at is not null then raise exception 'Invitation unavailable'; end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)=i.email and to_jsonb(u)->>'email_confirmed_at' is not null) then raise exception 'Sign in with the verified email address this invitation was sent to'; end if;
 if i.accepted_by=auth.uid() then return; end if;
 if i.accepted_at is not null or i.expires_at<=now() then raise exception 'Invitation expired or already accepted'; end if;
 if i.series_id is null then
  if not public.can_manage_boat_as_inviter(i.boat_id,i.created_by) then raise exception 'Invitation unavailable'; end if;
  if exists(select 1 from public.boats where id=i.boat_id and owner_id=auth.uid()) then raise exception 'The boat owner cannot be changed or removed'; end if;
  insert into public.boat_members(boat_id,user_id,role) values(i.boat_id,auth.uid(),i.member_role) on conflict(boat_id,user_id) do update set role=excluded.role;
 else
  if not exists(select 1 from public.series_entries where series_id=i.series_id and boat_id=i.boat_id) then raise exception 'Boat is no longer entered in this series'; end if;
  insert into public.boat_series_members(series_id,boat_id,user_id) values(i.series_id,i.boat_id,auth.uid()) on conflict do nothing;
 end if;
 update public.boat_invitations set accepted_by=auth.uid(),accepted_at=now() where id=i.id;
end $$;

create function public.can_manage_boat_as_inviter(bid uuid, uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.account_security where user_id=uid and suspended) and (
 exists(select 1 from public.boats where id=bid and owner_id=uid) or
 exists(select 1 from public.boat_members where boat_id=bid and user_id=uid and role='manager') or
 exists(select 1 from public.platform_admins where user_id=uid));
$$;

create or replace function public.prepare_boat_invitation_email(invitation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations;
begin
 perform public.require_active_account();
 select * into i from public.boat_invitations where id=invitation_id for update;
 if not found then raise exception 'Invitation unavailable'; end if;
 if i.series_id is null then
  if not public.can_manage_boat(i.boat_id) then raise exception 'Boat manager required'; end if;
 elsif not public.is_official(i.series_id) then raise exception 'Race official required'; end if;
 if i.revoked_at is not null or (i.accepted_at is null and i.expires_at<=now()) then raise exception 'Invitation unavailable'; end if;
 if i.accepted_at is not null and not (
 (i.series_id is null and exists(select 1 from public.boat_members where boat_id=i.boat_id and user_id=i.accepted_by and role=i.member_role)) or
 (i.series_id is not null and exists(select 1 from public.boat_series_members where series_id=i.series_id and boat_id=i.boat_id and user_id=i.accepted_by))) then raise exception 'Access is no longer granted'; end if;
 if i.email_attempt_at>now()-interval '60 seconds' then raise exception 'Wait a minute before retrying email'; end if;
 update public.boat_invitations set email_attempt_at=now() where id=i.id;
 return jsonb_build_object('email',i.email,'token',i.token,'boatId',i.boat_id,'role',i.member_role,'granted',i.accepted_at is not null,'boat',(select name from public.boats where id=i.boat_id),'series',(select name from public.series where id=i.series_id));
end $$;
revoke all on function public.can_manage_boat_as_inviter(uuid,uuid),public.grant_or_invite_boat_access(uuid,text,text,uuid),public.boat_team_invitations(uuid),public.revoke_boat_team_invitation(uuid) from public,anon,authenticated;
grant execute on function public.grant_or_invite_boat_access(uuid,text,text,uuid),public.boat_team_invitations(uuid),public.revoke_boat_team_invitation(uuid) to authenticated;
-- Include boat-wide invitations in the existing admin directory.
do $$ declare definition text; begin
 select pg_get_functiondef('public.admin_directory(text,integer)'::regprocedure) into definition;
 definition:=replace(definition,'join public.series s on s.id=i.series_id','left join public.series s on s.id=i.series_id');
 execute definition;
end $$;
notify pgrst, 'reload schema';
-- The admin directory uses the same revoke endpoint for both invitation scopes.
do $$ declare definition text; begin
 select pg_get_functiondef('public.revoke_boat_access(uuid,uuid,uuid,uuid)'::regprocedure) into definition;
 definition:=replace(definition,E'begin\n',E'begin\n if sid is null and invitation_id is not null then perform public.revoke_boat_team_invitation(invitation_id); return; end if;\n');
 execute definition;
end $$;
