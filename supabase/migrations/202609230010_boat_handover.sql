-- Creation provenance is not an accepted responsibility assignment. Existing
-- custodians retain access until an invited skipper explicitly accepts handover.
alter table public.boats add column responsibility_accepted_at timestamptz;
alter table public.boat_invitations add column handover boolean not null default false;
alter table public.boat_invitations add column handover_from uuid references auth.users;
alter table public.boat_invitations add constraint handover_role check(not handover or (series_id is null and member_role='manager' and handover_from is not null));

create function public.boat_responsibility(bid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.boats;
begin
 if not public.can_manage_boat(bid) then raise exception 'Boat manager required'; end if;
 select * into b from public.boats where id=bid;
 return jsonb_build_object('claimed',b.responsibility_accepted_at is not null,'canTransfer',b.owner_id=auth.uid() or coalesce(public.is_platform_admin(),false));
end $$;

create function public.request_boat_handover(bid uuid,recipient text) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.boats; i public.boat_invitations; normalized text:=lower(btrim(recipient));
begin
 perform public.require_active_account();
 select * into b from public.boats where id=bid for update;
 if not found or not (b.owner_id=auth.uid() or coalesce(public.is_platform_admin(),false)) then raise exception 'Only the responsible skipper or an administrator can hand over this boat'; end if;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid email required'; end if;
 if b.responsibility_accepted_at is not null and exists(select 1 from auth.users where id=b.owner_id and lower(email)=normalized) then raise exception 'This person is already responsible for the boat'; end if;
 if exists(select 1 from public.boat_invitations where boat_id=bid and handover and created_at>now()-interval '60 seconds' and revoked_at is null) then raise exception 'Wait a minute before resending'; end if;
 -- A single active handover; old links must never transfer the boat later.
 update public.boat_invitations set revoked_at=now() where boat_id=bid and accepted_at is null and revoked_at is null and (handover or email=normalized);
 insert into public.boat_invitations(boat_id,email,created_by,member_role,handover,handover_from)
 values(bid,normalized,auth.uid(),'manager',true,b.owner_id) returning * into i;
 return jsonb_build_object('id',i.id,'token',i.token,'status','pending');
end $$;
revoke all on function public.boat_responsibility(uuid),public.request_boat_handover(uuid,text) from public,anon,authenticated;
grant execute on function public.boat_responsibility(uuid),public.request_boat_handover(uuid,text) to authenticated;

-- Keep email delivery, verification, expiry and revocation in the existing flow.
do $$ declare definition text; begin
 select pg_get_functiondef('public.accept_boat_invitation(uuid)'::regprocedure) into definition;
 definition:=replace(definition,' -- Legacy links still work when their sender has boat-management authority.', $branch$
 if i.handover then
  if not exists(select 1 from public.boats where id=i.boat_id and owner_id=i.handover_from) then raise exception 'Boat responsibility has changed; request a new handover'; end if;
  if not public.can_manage_boat_as_inviter(i.boat_id,i.created_by) or not (i.created_by=i.handover_from or exists(select 1 from public.platform_admins where user_id=i.created_by)) then raise exception 'Handover is no longer authorized'; end if;
  update public.boats set owner_id=auth.uid(),responsibility_accepted_at=now(),updated_at=now() where id=i.boat_id;
  delete from public.boat_members where boat_id=i.boat_id and user_id in (i.handover_from,auth.uid());
  if i.handover_from<>auth.uid() then
   update public.tracking_sessions set stopped_at=least(now(),expires_at) where boat_id=i.boat_id and user_id=i.handover_from and stopped_at is null;
  end if;
  update public.boat_invitations set revoked_at=now() where boat_id=i.boat_id and id<>i.id and accepted_at is null and revoked_at is null and (handover or created_by=i.handover_from or email=i.email);
  update public.boat_invitations set accepted_by=auth.uid(),accepted_at=now() where id=i.id;
  return;
 end if;
 -- Legacy links still work when their sender has boat-management authority.$branch$);
 execute definition;
 select pg_get_functiondef('public.boat_invitation_preview(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'''boat'', b.name','''handover'', i.handover, ''boat'', b.name');
 -- pg_get_functiondef preserves the original SQL body's formatting.
 definition:=replace(definition,'''boat'',b.name','''handover'',i.handover,''boat'',b.name');
 execute definition;
 select pg_get_functiondef('public.prepare_boat_invitation_email(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'''email'',i.email','''handover'',i.handover,''email'',i.email');
 definition:=replace(definition,'if i.accepted_at is not null and not exists','if not i.handover and i.accepted_at is not null and not exists');
 execute definition;
 select pg_get_functiondef('public.boat_team_invitations(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'''id'',id','''handover'',handover,''id'',id');
 execute definition;
 select pg_get_functiondef('public.boat_team(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'''role'',''owner''','''role'',case when b.responsibility_accepted_at is null then ''creator'' else ''owner'' end');
 execute definition;
end $$;
notify pgrst, 'reload schema';
