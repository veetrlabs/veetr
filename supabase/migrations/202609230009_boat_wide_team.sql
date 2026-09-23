-- A boat has one team across all races. Internal "manager" is the Skipper role.
-- Preserve the strongest existing membership without changing boat ownership.
insert into public.boat_members(boat_id,user_id,role)
 select boat_id,user_id,case when bool_or(role='skipper') then 'manager' else 'crew' end
 from public.boat_series_members group by boat_id,user_id
 on conflict(boat_id,user_id) do update set role=case
 when boat_members.role in ('owner','manager') then boat_members.role
 when excluded.role='manager' then 'manager' else boat_members.role end;
-- Historical rows remain for audit/history, but no longer confer access.
create or replace function public.grant_or_invite_boat_access(bid uuid, recipient text, member_role text, sid uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(btrim(recipient)); target uuid; i public.boat_invitations;
begin
 perform public.require_active_account();
 perform 1 from public.boats where id=bid for update;
 if not public.can_manage_boat(bid) then raise exception 'Boat manager required'; end if;
 if sid is not null then raise exception 'Boat access applies to all races; omit the series'; end if;
 if member_role not in ('manager','crew') or member_role is null then raise exception 'Invalid boat role'; end if;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid email required'; end if;
 if exists(select 1 from public.boat_invitations where boat_id=bid and email=normalized and created_at>now()-interval '60 seconds' and revoked_at is null) then raise exception 'Wait a minute before resending'; end if;
 select id into target from auth.users u where lower(u.email)=normalized and to_jsonb(u)->>'email_confirmed_at' is not null;
 if target is not null then
  if exists(select 1 from public.account_security where user_id=target and suspended) then raise exception 'Restore the account before granting access'; end if;
  perform public.set_boat_member(bid,normalized,member_role);
 end if;
 update public.boat_invitations set revoked_at=now() where boat_id=bid and email=normalized and accepted_at is null and revoked_at is null;
 insert into public.boat_invitations(series_id,boat_id,email,created_by,member_role,accepted_by,accepted_at)
 values(sid,bid,normalized,auth.uid(),member_role,target,case when target is not null then now() end) returning * into i;
 return jsonb_build_object('id',i.id,'token',i.token,'status',case when target is null then 'pending' else 'granted' end);
end $$;
create or replace function public.boat_team_invitations(bid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_manage_boat(bid) then raise exception 'Boat manager required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'role',case when member_role='skipper' then 'manager' else member_role end,'sent',email_sent_at is not null,'status',case when accepted_at is null then 'pending' else 'granted' end) order by created_at desc)
 from public.boat_invitations where boat_id=bid and revoked_at is null and (expires_at>now() or accepted_at is not null)),'[]'::jsonb);
end $$;
create or replace function public.revoke_boat_team_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations;
begin
 select * into i from public.boat_invitations where id=invitation_id for update;
 if not public.can_manage_boat(i.boat_id) then raise exception 'Boat manager required'; end if;
 update public.boat_invitations set revoked_at=now() where id=i.id and accepted_at is null;
end $$;
create or replace function public.accept_boat_invitation(invite_token uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations;
begin
 perform public.require_active_account();
 select * into i from public.boat_invitations where token=invite_token;
 perform 1 from public.boats where id=i.boat_id for update;
 select * into i from public.boat_invitations where token=invite_token for update;
 if not found or i.revoked_at is not null then raise exception 'Invitation unavailable'; end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)=i.email and to_jsonb(u)->>'email_confirmed_at' is not null) then raise exception 'Sign in with the verified email address this invitation was sent to'; end if;
 if i.accepted_by=auth.uid() then return; end if;
 if i.accepted_at is not null or i.expires_at<=now() then raise exception 'Invitation expired or already accepted'; end if;
 -- Legacy links still work when their sender has boat-management authority.
 if not public.can_manage_boat_as_inviter(i.boat_id,i.created_by) then raise exception 'Ask the boat skipper to renew this invitation'; end if;
 if exists(select 1 from public.boats where id=i.boat_id and owner_id=auth.uid()) then raise exception 'The boat owner cannot be changed or removed'; end if;
 insert into public.boat_members(boat_id,user_id,role)
 values(i.boat_id,auth.uid(),case when i.member_role='skipper' then 'manager' else i.member_role end)
 on conflict(boat_id,user_id) do update set role=excluded.role;
 -- Accepting one invitation resolves older pending invitations for the same boat.
 update public.boat_invitations set revoked_at=now() where boat_id=i.boat_id and email=i.email and id<>i.id and accepted_at is null and revoked_at is null;
 update public.boat_invitations set accepted_by=auth.uid(),accepted_at=now() where id=i.id;
end $$;
create or replace function public.prepare_boat_invitation_email(invitation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations;
begin
 perform public.require_active_account();
 select * into i from public.boat_invitations where id=invitation_id for update;
 if not found then raise exception 'Invitation unavailable'; end if;
 if not public.can_manage_boat(i.boat_id) then raise exception 'Boat manager required'; end if;
 if i.revoked_at is not null or (i.accepted_at is null and i.expires_at<=now()) then raise exception 'Invitation unavailable'; end if;
 if i.accepted_at is not null and not exists(select 1 from public.boat_members where boat_id=i.boat_id and user_id=i.accepted_by and role=case when i.member_role='skipper' then 'manager' else i.member_role end) then raise exception 'Access is no longer granted'; end if;
 if i.email_attempt_at>now()-interval '60 seconds' then raise exception 'Wait a minute before retrying email'; end if;
 update public.boat_invitations set email_attempt_at=now() where id=i.id;
 return jsonb_build_object('email',i.email,'token',i.token,'boatId',i.boat_id,'role',case when i.member_role='skipper' then 'manager' else i.member_role end,'granted',i.accepted_at is not null,'boat',(select name from public.boats where id=i.boat_id),'series',null);
end $$;
create or replace function public.boat_invitation_preview(invite_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('boat',b.name,'series',null,'role',case when i.member_role='skipper' then 'manager' else i.member_role end,'status',case when i.revoked_at is not null then 'revoked' when i.accepted_at is not null then 'accepted' when i.expires_at<=now() then 'expired' else 'pending' end)
 from public.boat_invitations i join public.boats b on b.id=i.boat_id left join public.series s on s.id=i.series_id where i.token=invite_token;
$$;
-- Older clients must obey the same boat-level authorization.
create or replace function public.invite_boat_skipper(sid uuid,bid uuid,recipient text) returns jsonb language sql security definer set search_path='' as $$
 select public.grant_or_invite_boat_access(bid,recipient,'manager');
$$;
create or replace function public.revoke_boat_access(sid uuid,invitation_id uuid default null,bid uuid default null,member_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if invitation_id is not null then perform public.revoke_boat_team_invitation(invitation_id);
 else perform public.set_boat_member(bid,(select email from auth.users where id=member_id),'remove'); end if;
end $$;
-- Membership removal also invalidates pending invitations and running sessions.
do $$ declare definition text; begin
 select pg_get_functiondef('public.set_boat_member(uuid,text,text)'::regprocedure) into definition;
 definition:=replace(definition,'if member_role=''remove'' then delete',E'if member_role=''remove'' then
 update public.boat_invitations i set revoked_at=now() where i.boat_id=set_boat_member.boat_id and i.email=lower(btrim(member_email)) and i.revoked_at is null;
 update public.tracking_sessions t set stopped_at=least(now(),t.expires_at) where t.boat_id=set_boat_member.boat_id and t.user_id=member_id and t.stopped_at is null;
 delete');
 execute definition;
end $$;
create or replace function public.can_track_series_boat(p_series uuid,p_boat uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null
 and not exists(select 1 from public.account_security where user_id=p_user and suspended)
 and exists(select 1 from public.series_entries e join public.boats b on b.id=e.boat_id where e.series_id=p_series and e.boat_id=p_boat and
 (b.owner_id=p_user or exists(select 1 from public.boat_members m where m.boat_id=p_boat and m.user_id=p_user and m.role in ('editor','manager','crew'))));
$$;
create or replace function public.my_boats() returns jsonb language sql stable security definer set search_path='' as $$ select case when public.account_access_allowed() then (select coalesce(jsonb_agg(jsonb_build_object('boatId',b.id,'boat',b.name,'seriesId',s.id,'series',s.name,'role',case when b.owner_id=auth.uid() then 'owner' else m.role end,'open',public.series_tracking_open(s.id),'eligible',public.tracking_entry_visible(s.id,b.id),'races',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'date',r.race_date) order by r.race_date,r.race_order) from public.races r join public.race_entries e on e.race_id=r.id and e.boat_id=b.id where r.series_id=s.id),'[]'::jsonb)) order by b.name,s.name),'[]'::jsonb)
 from public.boats b join public.series_entries e on e.boat_id=b.id join public.series s on s.id=e.series_id left join public.boat_members m on m.boat_id=b.id and m.user_id=auth.uid() where public.can_track_series_boat(s.id,b.id,auth.uid())) else '[]'::jsonb end; $$;
-- Race invitations go to the existing boat team, without granting another role.
do $$ declare definition text; begin
 select pg_get_functiondef('public.race_invitation_recipients(uuid,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'m.role=''editor''','m.role in (''editor'',''manager'',''crew'')');
 execute definition;
end $$;
notify pgrst, 'reload schema';

-- Officials can see the boat team for race coordination; only boat managers
-- can retrieve invitations. Legacy series memberships are no longer the roster.
create or replace function public.boat_invitation_roster(sid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 return jsonb_build_object('invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'boatId',i.boat_id,'email',i.email,'token',case when i.accepted_at is null then i.token end,'expiresAt',i.expires_at,'sent',i.email_sent_at is not null,'status',case when i.accepted_at is not null then 'accepted' when i.expires_at<=now() then 'expired' else 'pending' end)) from public.boat_invitations i where i.revoked_at is null and public.can_manage_boat(i.boat_id) and exists(select 1 from public.series_entries e where e.series_id=sid and e.boat_id=i.boat_id)),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('boatId',m.boat_id,'userId',m.user_id,'email',u.email,'role',m.role)) from public.boat_members m join auth.users u on u.id=m.user_id where exists(select 1 from public.series_entries e where e.series_id=sid and e.boat_id=m.boat_id)),'[]'::jsonb));
end $$;
