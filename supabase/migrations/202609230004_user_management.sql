-- Global administrators and entity-scoped membership remain separate.
create table public.account_security (
 user_id uuid primary key references auth.users(id) on delete cascade,
 suspended boolean not null default false,
 sessions_revoked_before timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.account_security enable row level security;
revoke all on public.account_security from public, anon, authenticated;
create trigger audit_change after insert or update or delete on public.account_security
 for each row execute function public.capture_audit_change('user_id');

create function public.account_access_allowed() returns boolean language plpgsql stable security definer set search_path='' as $$
declare state public.account_security; claims jsonb; started timestamptz;
begin
 if auth.uid() is null then return false; end if;
 select * into state from public.account_security where user_id=auth.uid();
 if not found then return true; end if;
 if state.suspended then return false; end if;
 if state.sessions_revoked_before is null then return true; end if;
 claims := coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 -- A refreshed token still belongs to the original session. Never use token iat here.
 if claims->>'session_id' is null or to_regclass('auth.sessions') is null then return false; end if;
 execute 'select created_at from auth.sessions where id=$1 and user_id=$2' into started using (claims->>'session_id')::uuid, auth.uid();
 return coalesce(started > state.sessions_revoked_before,false);
end $$;
create function public.require_active_account() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not public.account_access_allowed() then raise exception 'Account access denied. Sign in again or contact an administrator.' using errcode='42501'; end if;
end $$;
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.account_access_allowed()
 and coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'aal'='aal2'
 and exists(select 1 from public.platform_admins where user_id=auth.uid());
$$;
create function public.require_platform_admin() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(public.is_platform_admin(),false) then raise exception 'Platform admin access with verified MFA required' using errcode='42501'; end if;
end $$;
create or replace function public.is_official(sid uuid, admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_access_allowed() and (coalesce(public.is_platform_admin(),false)
 or exists(select 1 from public.series where id=sid and owner_id=auth.uid())
 or exists(select 1 from public.race_officials where series_id=sid and user_id=auth.uid() and (not admin_only or role='admin')));
$$;
alter table public.boat_members drop constraint boat_members_role_check;
alter table public.boat_members add constraint boat_members_role_check check(role in ('owner','crew','editor','manager'));
create or replace function public.can_manage_boat(boat_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_access_allowed() and (coalesce(public.is_platform_admin(),false)
 or exists(select 1 from public.boats b where b.id=boat_id and b.owner_id=auth.uid())
 or exists(select 1 from public.boat_members m where m.boat_id=can_manage_boat.boat_id and m.user_id=auth.uid() and m.role='manager'));
$$;
create or replace function public.can_edit_boat(boat_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_access_allowed() and (public.can_manage_boat(boat_id)
 or exists(select 1 from public.boat_members m where m.boat_id=can_edit_boat.boat_id and m.user_id=auth.uid() and m.role='editor'));
$$;
create or replace function public.can_create_series() returns boolean language sql stable security definer set search_path='' as $$
 select public.account_access_allowed() and (coalesce(public.is_platform_admin(),false) or exists(select 1 from public.series_creators where user_id=auth.uid()));
$$;
-- Protect concurrent changes to the last administrator, including trusted dashboard writes.
create function public.protect_last_platform_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(736821901);
 if not exists(select 1 from public.platform_admins a left join public.account_security s on s.user_id=a.user_id where a.user_id<>old.user_id and not coalesce(s.suspended,false)) then
  raise exception 'The last active administrator cannot be removed';
 end if;
 return old;
end $$;
create trigger protect_last_admin before delete or update on public.platform_admins for each row execute function public.protect_last_platform_admin();

create function public.admin_users(search_text text default '', page_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 if page_offset < 0 or length(search_text)>200 then raise exception 'Invalid search'; end if;
 return coalesce((select jsonb_agg(row_data order by row_data->>'email',row_data->>'id') from (
 select jsonb_build_object('id',u.id,'email',u.email,'verified',to_jsonb(u)->>'email_confirmed_at' is not null,
 'admin',exists(select 1 from public.platform_admins a where a.user_id=u.id),
 'suspended',coalesce(sec.suspended,false),
 'seriesCreator',exists(select 1 from public.series_creators c where c.user_id=u.id),
 'roles',coalesce((select jsonb_agg(x) from (
 select jsonb_build_object('scope','series','id',s.id,'name',s.name,'role','owner') x from public.series s where s.owner_id=u.id
 union all select jsonb_build_object('scope','series','id',s.id,'name',s.name,'role',case o.role when 'admin' then 'manager' else 'referee' end) from public.race_officials o join public.series s on s.id=o.series_id where o.user_id=u.id and s.owner_id<>u.id
 union all select jsonb_build_object('scope','boat','id',b.id,'name',b.name,'role','owner') from public.boats b where b.owner_id=u.id
 union all select jsonb_build_object('scope','boat','id',b.id,'name',b.name,'role',m.role) from public.boat_members m join public.boats b on b.id=m.boat_id where m.user_id=u.id and b.owner_id<>u.id
 ) roles),'[]'::jsonb)) row_data
 from auth.users u left join public.account_security sec on sec.user_id=u.id
 where strpos(lower(coalesce(u.email,'')),lower(search_text))>0 order by u.email,u.id limit 50 offset page_offset
 ) users),'[]'::jsonb);
end $$;
create function public.admin_set_access(target_user uuid, access_role text, enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 perform pg_advisory_xact_lock(736821901);
 if enabled is null or access_role not in ('admin','series_creator') or access_role is null then raise exception 'Invalid access role'; end if;
 if not exists(select 1 from auth.users where id=target_user) then raise exception 'Account not found'; end if;
 if enabled and exists(select 1 from public.account_security where user_id=target_user and suspended) then raise exception 'Restore the account before granting access'; end if;
 if access_role='admin' then
  if enabled then insert into public.platform_admins values(target_user) on conflict do nothing;
  else delete from public.platform_admins where user_id=target_user; end if;
 else
  if enabled then insert into public.series_creators values(target_user) on conflict do nothing;
  else delete from public.series_creators where user_id=target_user; end if;
 end if;
end $$;
create function public.admin_set_account_status(target_user uuid, suspend boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 perform pg_advisory_xact_lock(736821901);
 if suspend is null then raise exception 'Account status required'; end if;
 if target_user=auth.uid() then raise exception 'You cannot suspend your own account'; end if;
 if suspend and exists(select 1 from public.platform_admins where user_id=target_user)
 and not exists(select 1 from public.platform_admins a left join public.account_security s on s.user_id=a.user_id where a.user_id<>target_user and not coalesce(s.suspended,false)) then raise exception 'The last active administrator cannot be suspended'; end if;
 insert into public.account_security(user_id,suspended,sessions_revoked_before) values(target_user,suspend,clock_timestamp())
 on conflict(user_id) do update set suspended=excluded.suspended,sessions_revoked_before=excluded.sessions_revoked_before,updated_at=now();
end $$;
create function public.admin_revoke_sessions(target_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 insert into public.account_security(user_id,sessions_revoked_before) values(target_user,clock_timestamp())
 on conflict(user_id) do update set sessions_revoked_before=excluded.sessions_revoked_before,updated_at=now();
end $$;
create function public.admin_entities() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 return jsonb_build_object('series',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.series),'[]'::jsonb),
 'boats',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.boats),'[]'::jsonb));
end $$;
create function public.admin_set_membership(target_user uuid, entity_type text, entity_id uuid, member_role text) returns void language plpgsql security definer set search_path='' as $$
declare email text;
begin
 perform public.require_platform_admin();
 select u.email into email from auth.users u where u.id=target_user;
 if email is null then raise exception 'Account not found'; end if;
 if entity_type='series' and member_role in ('manager','referee','remove') then
  perform public.set_series_member(entity_id,email,case member_role when 'manager' then 'admin' when 'referee' then 'official' else 'remove' end);
 elsif entity_type='boat' and member_role in ('manager','crew','editor','remove') then
  perform public.set_boat_member(entity_id,email,member_role);
 else raise exception 'Invalid membership'; end if;
end $$;
create function public.admin_audit(before_id bigint default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 return coalesce((select jsonb_agg(v order by v.id desc) from (
 select id,occurred_at,actor_email,action,entity_table,entity_key,old_values,new_values
 from public.audit_log where entity_table in ('platform_admins','series_creators','race_officials','boat_members','account_security')
 and (before_id is null or id<before_id) order by id desc limit 50
 ) v),'[]'::jsonb);
end $$;

create or replace function public.save_series(payload jsonb,expected_revision integer,mutation_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare e jsonb; previous jsonb;
begin
 perform public.require_active_account();
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform public.validate_discard_rules(payload->'discards');
 if payload ? 'events' then
  if jsonb_typeof(payload->'events')<>'array' then raise exception 'Invalid events'; end if;
  if (select count(distinct v->>'id') from jsonb_array_elements(payload->'events') v)<>jsonb_array_length(payload->'events') or (select count(distinct v->>'order') from jsonb_array_elements(payload->'events') v)<>jsonb_array_length(payload->'events') then raise exception 'Events need unique IDs and order'; end if;
  for e in select value from jsonb_array_elements(payload->'events') loop
   perform (e->>'id')::uuid;
   if coalesce(length(trim(e->>'name')),0)=0 or coalesce((e->>'order')::numeric,0)<1 or (e->>'order')::numeric<>trunc((e->>'order')::numeric) or coalesce((e->>'weight')::numeric,0)<=0 or jsonb_typeof(e->'completed') is distinct from 'boolean' then raise exception 'Invalid event'; end if;
   perform public.validate_discard_rules(e->'discards');
  end loop;
  if exists(select 1 from jsonb_array_elements(payload->'races') r where not exists(select 1 from jsonb_array_elements(payload->'events') event_row where event_row->>'id'=r->>'eventId')) then raise exception 'Every heat needs an event'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(payload->>'id',0));
 select document into previous from public.series where id=(payload->>'id')::uuid for update;
 if previous is not null and public.is_official((payload->>'id')::uuid) and not public.is_official((payload->>'id')::uuid,true) then
  if (payload-'races') is distinct from (previous-'races') then raise exception 'Series manager required to change series settings'; end if;
  if (select coalesce(jsonb_agg(r-'results'-'entries'-'status' order by r->>'id'),'[]'::jsonb) from jsonb_array_elements(payload->'races') r)
    is distinct from (select coalesce(jsonb_agg(r-'results'-'entries'-'status' order by r->>'id'),'[]'::jsonb) from jsonb_array_elements(previous->'races') r) then
   raise exception 'Series manager required to change heat settings';
  end if;
 end if;
 return public.save_series_snapshot(payload,expected_revision,mutation_id);
end; $$;

create or replace function public.create_boat(boat_id uuid, boat_name text, boat_class text, boat_length numeric default null) returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform public.require_active_account();
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(trim(boat_name))=0 then raise exception 'Boat name required'; end if;
 insert into public.boats(id,owner_id,name,sail_number,class_name,length_m) values(boat_id,auth.uid(),trim(boat_name),'',coalesce(boat_class,''),boat_length);
 return boat_id;
end;
$$;

create or replace function public.accept_boat_invitation(invite_token uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations; sid uuid;
begin
 perform public.require_active_account();
 select series_id into sid from public.boat_invitations where token=invite_token;
 perform 1 from public.series where id=sid for update;
 select * into i from public.boat_invitations where token=invite_token for update;
 if not found or i.revoked_at is not null then raise exception 'Invitation unavailable'; end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)=i.email and to_jsonb(u)->>'email_confirmed_at' is not null) then raise exception 'Sign in with the verified email address this invitation was sent to'; end if;
 if i.accepted_by=auth.uid() then return; end if;
 if i.accepted_at is not null or i.expires_at<=now() then raise exception 'Invitation expired or already accepted'; end if;
 if not exists(select 1 from public.series_entries where series_id=i.series_id and boat_id=i.boat_id) then raise exception 'Boat is no longer entered in this series'; end if;
 insert into public.boat_series_members(series_id,boat_id,user_id) values(i.series_id,i.boat_id,auth.uid()) on conflict do nothing;
 update public.boat_invitations set accepted_by=auth.uid(),accepted_at=now() where id=i.id;
end; $$;

create or replace function public.request_creation_access(reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_active_account();
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and to_jsonb(u)->>'email_confirmed_at' is not null) then raise exception 'Verify your email before requesting access'; end if;
 insert into public.series_access_requests(user_id,note) values(auth.uid(),trim(reason));
end; $$;

create or replace function public.connect_my_race_phone(eid uuid,bid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare secret text; sid uuid;
begin
 perform public.require_active_account();
 select series_id into sid from public.race_tracking_events where id=eid and expires_at>now();
 if not public.can_track_series_boat(sid,bid,auth.uid()) then raise exception 'Boat access required'; end if;
 secret=gen_random_uuid()::text||gen_random_uuid()::text;
 insert into public.race_tracking_links(event_id,boat_id,token_hash) values(eid,bid,public.race_phone_hash(secret));
 return jsonb_build_object('token',secret);
end; $$;

create or replace function public.start_tracking_session(p_id uuid,p_series uuid,p_boat uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sess public.tracking_sessions;
begin
 perform public.require_active_account();
 perform 1 from public.series where id=p_series for update;
 if not public.can_track_series_boat(p_series,p_boat,auth.uid()) then raise exception 'Boat owner or editor, or invited skipper required'; end if;
 if not public.series_tracking_open(p_series) then raise exception 'Tracking is closed. Ask the referee to open tracking.'; end if;
 if not public.tracking_entry_visible(p_series,p_boat) then raise exception 'Boat must be entered in a published heat'; end if;
 -- Serialize starts across phones, even when there are no existing session rows.
 perform 1 from public.boats where id=p_boat for update;
 select * into sess from public.tracking_sessions where id=p_id;
 if found then
  if sess.user_id<>auth.uid() or sess.series_id<>p_series or sess.boat_id<>p_boat then raise exception 'Session ID already used'; end if;
  if sess.stopped_at is not null or sess.expires_at<=now() then raise exception 'Session has ended'; end if;
 else
  update public.tracking_sessions set stopped_at=expires_at where boat_id=p_boat and stopped_at is null and expires_at<=now();
  if exists(select 1 from public.tracking_sessions where boat_id=p_boat and stopped_at is null) then raise exception 'This boat is already tracking on another session. Stop that session first.'; end if;
  insert into public.tracking_sessions(id,series_id,boat_id,user_id) values(p_id,p_series,p_boat,auth.uid()) returning * into sess;
  update public.tracking_sessions set expires_at=least(expires_at,coalesce((select open_until from public.series_tracking_windows where series_id=p_series),expires_at)) where id=p_id returning * into sess;
 end if;
 return jsonb_build_object('id',sess.id,'startedAt',sess.started_at,'expiresAt',sess.expires_at);
end;
$$;

create or replace function public.take_over_tracking_session(p_id uuid,p_series uuid,p_boat uuid,p_replay boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.require_active_account();
 perform 1 from public.series where id=p_series for update;
 if not public.can_track_series_boat(p_series,p_boat,auth.uid()) or not public.tracking_entry_visible(p_series,p_boat) or not public.series_tracking_open(p_series) then raise exception 'Tracking is closed or boat access is missing'; end if;
 perform 1 from public.boats where id=p_boat for update;
 -- Retry of an acknowledged/uncertain start never stops its own session.
 if not exists(select 1 from public.tracking_sessions where id=p_id) then
 update public.tracking_sessions set stopped_at=least(now(),expires_at) where boat_id=p_boat and stopped_at is null;
 end if;
 if p_replay then return public.start_replay_tracking_session(p_id,p_series,p_boat); end if;
 return public.start_tracking_session(p_id,p_series,p_boat);
end; $$;

create or replace function public.stop_tracking_session(p_id uuid,p_stopped_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare sess public.tracking_sessions;
begin
 perform public.require_active_account();
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into sess from public.tracking_sessions where id=p_id for update;
 if not found then return; end if; -- also handles an unacknowledged failed start
 if sess.user_id<>auth.uid() then raise exception 'Session owner required'; end if;
 if p_stopped_at is null then raise exception 'Stop time required'; end if;
 update public.tracking_sessions set stopped_at=least(coalesce(stopped_at,now()),greatest(started_at,p_stopped_at),expires_at) where id=p_id;
end;
$$;

create or replace function public.invite_boat_skipper(sid uuid,bid uuid,recipient text) returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.boat_invitations; normalized text:=lower(btrim(recipient));
begin
 perform public.require_active_account();
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 perform 1 from public.series where id=sid for update;
 if not exists(select 1 from public.series_entries where series_id=sid and boat_id=bid) then raise exception 'Sync this boat into the series before inviting'; end if;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid email required'; end if;
 if exists(select 1 from public.boat_invitations where series_id=sid and boat_id=bid and email=normalized and created_at>now()-interval '60 seconds' and revoked_at is null) then raise exception 'Wait a minute before resending'; end if;
 update public.boat_invitations set revoked_at=now() where series_id=sid and boat_id=bid and email=normalized and accepted_at is null and revoked_at is null;
 insert into public.boat_invitations(series_id,boat_id,email,created_by) values(sid,bid,normalized,auth.uid()) returning * into invitation;
 return jsonb_build_object('id',invitation.id,'token',invitation.token);
end; $$;

create or replace function public.prepare_boat_invitation_email(invitation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations;
begin
 perform public.require_active_account();
 select * into i from public.boat_invitations where id=invitation_id for update;
 if not found or not public.is_official(i.series_id) then raise exception 'Race official required'; end if;
 if i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now() then raise exception 'Invitation unavailable'; end if;
 if i.email_attempt_at>now()-interval '60 seconds' then raise exception 'Wait a minute before retrying email'; end if;
 update public.boat_invitations set email_attempt_at=now() where id=i.id;
 return jsonb_build_object('email',i.email,'token',i.token,'boat',(select name from public.boats where id=i.boat_id),'series',(select name from public.series where id=i.series_id));
end; $$;

create or replace function public.prepare_race_invitation_email(token text,recipient_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.race_tracking_links; e public.race_tracking_events; recipient text;
begin
 perform public.require_active_account();
 select * into l from public.race_tracking_links where token_hash=public.race_phone_hash(token) for update;
 select * into e from public.race_tracking_events where id=l.event_id;
 if l.id is null or not public.is_official(e.series_id) then raise exception 'Race official required'; end if;
 if l.revoked_at is not null or e.ended_at is not null or e.expires_at<=now() then raise exception 'Invitation expired or revoked'; end if;
 select r->>'email' into recipient from jsonb_array_elements(public.race_invitation_recipients(e.series_id,l.boat_id)) r where r->>'id'=recipient_id::text;
 if recipient is null then raise exception 'Choose a configured boat administrator'; end if;
 if l.email_attempt_at>now()-interval '60 seconds' then raise exception 'Wait a minute before retrying email'; end if;
 update public.race_tracking_links set email_attempt_at=now() where id=l.id;
 return jsonb_build_object('id',l.id,'email',recipient,'token',token,'boat',(select name from public.boats where id=l.boat_id),'race',e.name,'deliveryKey',gen_random_uuid());
end; $$;

create or replace function public.review_creation_access(request_id uuid, approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 perform public.require_platform_admin();
 update public.series_access_requests set status=case when approve then 'approved' else 'declined' end,reviewed_at=now(),reviewed_by=auth.uid() where id=request_id and status='pending' returning user_id into target;
 if target is null then raise exception 'Request already reviewed or not found'; end if;
 if approve then insert into public.series_creators values(target) on conflict do nothing; end if;
end; $$;

create or replace function public.list_creation_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'email',u.email,'note',r.note,'status',r.status) order by r.created_at) from public.series_access_requests r join auth.users u on u.id=r.user_id where r.status='pending'),'[]'::jsonb);
end; $$;

create or replace function public.set_boat_member(boat_id uuid,member_email text,member_role text) returns void language plpgsql security definer set search_path='' as $$
declare member_id uuid;
begin
 perform 1 from public.boats b where b.id=boat_id for update;
 if not public.can_manage_boat(boat_id) then raise exception 'Boat owner required'; end if;
 if member_role is null or member_role not in ('editor','manager','crew','remove') then raise exception 'Invalid boat role'; end if;
 select id into member_id from auth.users where lower(email)=lower(btrim(member_email));
 if member_id is null then raise exception 'No account found. Ask this teammate to sign in once, then add their email here.'; end if;
 if exists(select 1 from public.boats b where b.id=boat_id and b.owner_id=member_id) then raise exception 'The boat owner cannot be changed or removed'; end if;
 if member_role='remove' then delete from public.boat_members m where m.boat_id=set_boat_member.boat_id and user_id=member_id;
 else insert into public.boat_members values(boat_id,member_id,member_role) on conflict on constraint boat_members_pkey do update set role=excluded.role; end if;
end $$;

create or replace function public.my_boats() returns jsonb language sql stable security definer set search_path='' as $$ select case when public.account_access_allowed() then (select coalesce(jsonb_agg(jsonb_build_object('boatId',b.id,'boat',b.name,'seriesId',s.id,'series',s.name,'role',m.role,'open',public.series_tracking_open(s.id),'eligible',public.tracking_entry_visible(s.id,b.id),'races',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'date',r.race_date) order by r.race_date,r.race_order) from public.races r join public.race_entries e on e.race_id=r.id and e.boat_id=b.id where r.series_id=s.id),'[]'::jsonb)) order by b.name,s.name),'[]'::jsonb)
 from public.boat_series_members m join public.boats b on b.id=m.boat_id join public.series s on s.id=m.series_id join public.series_entries e on e.series_id=m.series_id and e.boat_id=m.boat_id where m.user_id=auth.uid()) else '[]'::jsonb end; $$;

create or replace function public.my_tracking_entries() returns jsonb language sql stable security definer set search_path='' as $$ select case when public.account_access_allowed() then (select coalesce(jsonb_agg(jsonb_build_object('seriesId',s.id,'seriesName',s.name,'boatId',b.id,'boatName',b.name,
 'open',public.series_tracking_open(s.id),'eligible',public.tracking_entry_visible(s.id,b.id),
 'tracking',exists(select 1 from public.tracking_sessions ts where ts.boat_id=b.id and ts.stopped_at is null and ts.expires_at>now())) order by s.year desc,s.name,b.name),'[]'::jsonb)
 from public.series_entries e join public.series s on s.id=e.series_id join public.boats b on b.id=e.boat_id where public.can_track_series_boat(s.id,b.id,auth.uid())) else '[]'::jsonb end; $$;

create or replace function public.my_ready_races() returns jsonb language sql stable security definer set search_path='' as $$ select case when public.account_access_allowed() then (select coalesce(jsonb_agg(jsonb_build_object('eventId',e.id,'raceName',e.name,'scheduledStart',e.scheduled_start,'expiresAt',e.expires_at,'boatId',b.id,'boatName',b.name,'eligible',public.race_phone_entry(e.id,b.id)) order by e.scheduled_start,b.name),'[]'::jsonb)
 from public.race_tracking_events e join public.series_entries se on se.series_id=e.series_id join public.boats b on b.id=se.boat_id
 where e.ended_at is null and e.expires_at>now() and public.can_track_series_boat(e.series_id,b.id,auth.uid())) else '[]'::jsonb end; $$;

-- A pre-request check covers every Data API endpoint, including future RPCs.
create function public.check_account_access() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is not null then perform public.require_active_account(); end if;
end $$;
do $$
declare configured text; item record;
begin
 if exists(select 1 from pg_roles where rolname='authenticator') then
  select split_part(setting,'=',2) into configured from pg_roles r cross join unnest(r.rolconfig) setting where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%';
  if configured is not null and configured not in ('','public.check_account_access') then raise exception 'Existing Data API pre-request hook must be integrated first'; end if;
  execute 'alter role authenticator set pgrst.db_pre_request = ''public.check_account_access''';
 end if;
 -- Defense in depth for table reads, including Realtime.
 for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity and c.relkind='r' loop
  execute format('create policy active_account on public.%I as restrictive for all to authenticated using (public.account_access_allowed()) with check (public.account_access_allowed())',item.relname);
 end loop;
end $$;
notify pgrst, 'reload config';
revoke all on function public.account_access_allowed(),public.require_active_account(),public.is_platform_admin(),public.require_platform_admin(),public.protect_last_platform_admin(),public.check_account_access(),public.admin_users(text,integer),public.admin_set_access(uuid,text,boolean),public.admin_set_account_status(uuid,boolean),public.admin_revoke_sessions(uuid),public.admin_entities(),public.admin_set_membership(uuid,text,uuid,text),public.admin_audit(bigint) from public,anon,authenticated;
grant execute on function public.account_access_allowed(),public.is_platform_admin(),public.check_account_access(),public.admin_users(text,integer),public.admin_set_access(uuid,text,boolean),public.admin_set_account_status(uuid,boolean),public.admin_revoke_sessions(uuid),public.admin_entities(),public.admin_set_membership(uuid,text,uuid,text),public.admin_audit(bigint) to authenticated;
grant execute on function public.check_account_access() to anon;

create or replace function public.creation_access() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('admin',public.account_access_allowed() and exists(select 1 from public.platform_admins where user_id=auth.uid()),
 'allowed',public.can_create_series(),'mfaVerified',coalesce(public.is_platform_admin(),false),
 'requestId',(select id from public.series_access_requests where user_id=auth.uid() and public.account_access_allowed()),
 'emailSent',(select email_sent_at is not null from public.series_access_requests where user_id=auth.uid() and public.account_access_allowed()),
 'status',(select status from public.series_access_requests where user_id=auth.uid() and public.account_access_allowed()));
$$;
create or replace function public.can_track_series_boat(p_series uuid,p_boat uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null
 and not exists(select 1 from public.account_security where user_id=p_user and suspended)
 and exists(select 1 from public.series_entries e join public.boats b on b.id=e.boat_id where e.series_id=p_series and e.boat_id=p_boat and
 (b.owner_id=p_user or exists(select 1 from public.boat_members m where m.boat_id=p_boat and m.user_id=p_user and m.role in ('editor','manager','crew')) or exists(select 1 from public.boat_series_members m where m.series_id=p_series and m.boat_id=p_boat and m.user_id=p_user)));
$$;

-- Invitation tokens stay private; administrators see only recipient and scope.
create function public.admin_pending_invitations() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_platform_admin();
 return coalesce((select jsonb_agg(v order by v.created_at desc) from (
 select i.id,i.series_id,i.email,i.created_at,i.expires_at,s.name as series_name,b.name as boat_name
 from public.boat_invitations i join public.series s on s.id=i.series_id join public.boats b on b.id=i.boat_id
 where i.accepted_at is null and i.revoked_at is null and i.expires_at>now()
 order by i.created_at desc limit 100
 ) v),'[]'::jsonb);
end $$;
revoke all on function public.admin_pending_invitations() from public,anon,authenticated;
grant execute on function public.admin_pending_invitations() to authenticated;
notify pgrst, 'reload schema';
