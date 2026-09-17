-- Record provenance separately from profile management. Existing owner_id remains
-- the legacy profile manager; neither field grants permission to sail/track.
alter table public.boats add column created_by uuid references auth.users;
update public.boats set created_by=owner_id;
create function public.record_boat_creator() returns trigger language plpgsql set search_path='' as $$
begin new.created_by:=coalesce(auth.uid(),new.owner_id); return new; end; $$;
create trigger boat_creator before insert on public.boats for each row execute function public.record_boat_creator();
revoke all on function public.record_boat_creator() from public;

create table public.boat_invitations (
 id uuid primary key default gen_random_uuid(),
 series_id uuid not null references public.series on delete cascade,
 boat_id uuid not null references public.boats on delete cascade,
 email text not null check(length(email) between 3 and 254),
 token uuid not null unique default gen_random_uuid(),
 created_by uuid not null references auth.users,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_by uuid references auth.users, accepted_at timestamptz, revoked_at timestamptz,
 email_attempt_at timestamptz, email_sent_at timestamptz
);
create unique index boat_invitation_pending on public.boat_invitations(series_id,boat_id,email) where accepted_at is null and revoked_at is null;
-- Do not reference series_entries: the offline snapshot RPC rebuilds that projection.
create table public.boat_series_members (
 series_id uuid not null references public.series on delete cascade,
 boat_id uuid not null references public.boats on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 role text not null default 'skipper' check(role in ('skipper','crew')),
 primary key(series_id,boat_id,user_id)
);

create table public.series_tracking_windows (
 series_id uuid primary key references public.series on delete cascade,
 open_until timestamptz not null
);
alter table public.boat_invitations enable row level security;
alter table public.boat_series_members enable row level security;
alter table public.series_tracking_windows enable row level security;
revoke all on public.boat_invitations,public.boat_series_members,public.series_tracking_windows from public,anon,authenticated;
create trigger audit_change after insert or update or delete on public.boat_series_members for each row execute function public.capture_audit_change('series_id','boat_id','user_id');
create trigger audit_change after insert or update or delete on public.series_tracking_windows for each row execute function public.capture_audit_change('series_id');
-- Invitation tokens never enter the general audit log.
create function public.invite_boat_skipper(sid uuid,bid uuid,recipient text) returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.boat_invitations; normalized text:=lower(btrim(recipient));
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 perform 1 from public.series where id=sid for update;
 if not exists(select 1 from public.series_entries where series_id=sid and boat_id=bid) then raise exception 'Sync this boat into the series before inviting'; end if;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid email required'; end if;
 if exists(select 1 from public.boat_invitations where series_id=sid and boat_id=bid and email=normalized and created_at>now()-interval '60 seconds' and revoked_at is null) then raise exception 'Wait a minute before resending'; end if;
 update public.boat_invitations set revoked_at=now() where series_id=sid and boat_id=bid and email=normalized and accepted_at is null and revoked_at is null;
 insert into public.boat_invitations(series_id,boat_id,email,created_by) values(sid,bid,normalized,auth.uid()) returning * into invitation;
 return jsonb_build_object('id',invitation.id,'token',invitation.token);
end; $$;
create function public.boat_invitation_roster(sid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 return jsonb_build_object('invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'boatId',i.boat_id,'email',i.email,'token',case when i.accepted_at is null then i.token end,'expiresAt',i.expires_at,'sent',i.email_sent_at is not null,'status',case when i.accepted_at is not null then 'accepted' when i.expires_at<=now() then 'expired' else 'pending' end) order by i.created_at desc) from public.boat_invitations i where i.series_id=sid and i.revoked_at is null),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('boatId',m.boat_id,'userId',m.user_id,'email',u.email,'role',m.role)) from public.boat_series_members m join auth.users u on u.id=m.user_id where m.series_id=sid),'[]'::jsonb));
end; $$;
create function public.revoke_boat_access(sid uuid,invitation_id uuid default null,bid uuid default null,member_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 perform 1 from public.series where id=sid for update;
 if invitation_id is not null then
 update public.boat_invitations set revoked_at=now() where id=invitation_id and series_id=sid and accepted_at is null;
 else
 delete from public.boat_series_members where series_id=sid and boat_id=bid and user_id=member_id;
 update public.boat_invitations set revoked_at=now() where series_id=sid and boat_id=bid and accepted_by=member_id;
 update public.tracking_sessions t set stopped_at=least(now(),t.expires_at) where t.series_id=sid and t.boat_id=bid and t.user_id=member_id and t.stopped_at is null;
 end if;
end; $$;
create function public.boat_invitation_preview(invite_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('boat',b.name,'series',s.name,'status',case when i.revoked_at is not null then 'revoked' when i.accepted_at is not null then 'accepted' when i.expires_at<=now() then 'expired' else 'pending' end)
 from public.boat_invitations i join public.boats b on b.id=i.boat_id join public.series s on s.id=i.series_id where i.token=invite_token;
$$;
create function public.accept_boat_invitation(invite_token uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations; sid uuid;
begin
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
-- Only the authenticated official can prepare a delivery. The Edge Function uses
-- their JWT, so its service key never bypasses this authorization check.
create function public.prepare_boat_invitation_email(invitation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.boat_invitations;
begin
 select * into i from public.boat_invitations where id=invitation_id for update;
 if not found or not public.is_official(i.series_id) then raise exception 'Race official required'; end if;
 if i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now() then raise exception 'Invitation unavailable'; end if;
 if i.email_attempt_at>now()-interval '60 seconds' then raise exception 'Wait a minute before retrying email'; end if;
 update public.boat_invitations set email_attempt_at=now() where id=i.id;
 return jsonb_build_object('email',i.email,'token',i.token,'boat',(select name from public.boats where id=i.boat_id),'series',(select name from public.series where id=i.series_id));
end; $$;
create function public.mark_boat_invitation_sent(invitation_id uuid) returns void language sql security definer set search_path='' as $$
 update public.boat_invitations set email_sent_at=now() where id=invitation_id;
$$;
-- Preserve existing owner/editor access while adding scoped skipper access.
-- Profile management remains independent: accepting never changes boat_members/owner_id.
create function public.can_track_series_boat(p_series uuid,p_boat uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from public.series_entries e join public.boats b on b.id=e.boat_id where e.series_id=p_series and e.boat_id=p_boat and
 (b.owner_id=p_user or exists(select 1 from public.boat_members m where m.boat_id=p_boat and m.user_id=p_user and m.role='editor') or exists(select 1 from public.boat_series_members m where m.series_id=p_series and m.boat_id=p_boat and m.user_id=p_user)));
$$;
create function public.series_tracking_open(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select open_until>now() from public.series_tracking_windows where series_id=sid),(select status='active' from public.series where id=sid),false);
$$;
create function public.set_tracking_window(sid uuid,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 perform 1 from public.series where id=sid for update;
 insert into public.series_tracking_windows values(sid,case when enabled then now()+interval '12 hours' else now() end) on conflict(series_id) do update set open_until=excluded.open_until;
 if not enabled then update public.tracking_sessions set stopped_at=least(now(),expires_at) where series_id=sid and stopped_at is null; end if;
end; $$;
create function public.tracking_window(sid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 return jsonb_build_object('open',public.series_tracking_open(sid),'until',(select open_until from public.series_tracking_windows where series_id=sid));
end; $$;
create function public.my_boats() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('boatId',b.id,'boat',b.name,'seriesId',s.id,'series',s.name,'role',m.role,'open',public.series_tracking_open(s.id),'eligible',public.tracking_entry_visible(s.id,b.id),'races',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'date',r.race_date) order by r.race_date,r.race_order) from public.races r join public.race_entries e on e.race_id=r.id and e.boat_id=b.id where r.series_id=s.id),'[]'::jsonb)) order by b.name,s.name),'[]'::jsonb)
 from public.boat_series_members m join public.boats b on b.id=m.boat_id join public.series s on s.id=m.series_id join public.series_entries e on e.series_id=m.series_id and e.boat_id=m.boat_id where m.user_id=auth.uid();
$$;
create or replace function public.my_tracking_entries() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('seriesId',s.id,'seriesName',s.name,'boatId',b.id,'boatName',b.name,
 'tracking',exists(select 1 from public.tracking_sessions ts where ts.boat_id=b.id and ts.stopped_at is null and ts.expires_at>now())) order by s.year desc,s.name,b.name),'[]'::jsonb)
 from public.series_entries e join public.series s on s.id=e.series_id join public.boats b on b.id=e.boat_id
 where public.can_track_series_boat(s.id,b.id,auth.uid()) and public.tracking_entry_visible(s.id,b.id) and public.series_tracking_open(s.id);
$$;
create or replace function public.start_tracking_session(p_id uuid,p_series uuid,p_boat uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sess public.tracking_sessions;
begin
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

create or replace function public.ingest_tracking_points(p_session uuid,p_points jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare sess public.tracking_sessions; point jsonb; stamp timestamptz;
begin
 select * into sess from public.tracking_sessions where id=p_session for update;
 if sess.id is null or auth.uid() is null or sess.user_id<>auth.uid() or not public.can_track_series_boat(sess.series_id,sess.boat_id,auth.uid()) then raise exception 'Tracking authorization lost'; end if;
 if not public.tracking_entry_visible(sess.series_id,sess.boat_id) then raise exception 'Tracking entry is no longer public'; end if;
 if now()>sess.expires_at+interval '24 hours' then raise exception 'Upload window expired'; end if;
 if jsonb_typeof(p_points) is distinct from 'array' then raise exception 'Points must be an array'; end if;
 if jsonb_array_length(p_points) not between 1 and 120 then raise exception 'Send 1 to 120 points per batch'; end if;
 for point in select value from jsonb_array_elements(p_points) loop
  if jsonb_typeof(point) is distinct from 'object' or not(point ?& array['seq','recordedAt','latitude','longitude','accuracyM']) then raise exception 'Incomplete point'; end if;
  stamp := (point->>'recordedAt')::timestamptz;
  if stamp is null or stamp<sess.started_at-interval '1 minute' or stamp>now()+interval '30 seconds' or stamp>least(sess.expires_at,coalesce(sess.stopped_at,sess.expires_at)) then raise exception 'Point outside tracking session'; end if;
  -- Validate every retry too; malformed batches roll back as one transaction.
  insert into public.tracking_points(session_id,seq,recorded_at,latitude,longitude,accuracy_m,sog_mps,cog_deg,source)
  values(p_session,(point->>'seq')::bigint,stamp,(point->>'latitude')::double precision,(point->>'longitude')::double precision,
   (point->>'accuracyM')::double precision,(point->>'sogMps')::double precision,(point->>'cogDeg')::double precision,coalesce(point->>'source','phone'))
  on conflict(session_id,seq) do nothing;
 end loop;
 -- Acknowledge the submitted batch, including rows from an earlier successful retry.
 return jsonb_array_length(p_points);
end;
$$;

create or replace function public.public_tracking_positions(p_series uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('boatId',b.id,'boatName',b.name,'recordedAt',p.recorded_at,
 'latitude',p.latitude,'longitude',p.longitude,'accuracyM',p.accuracy_m,'sogMps',p.sog_mps,'cogDeg',p.cog_deg,
 'source',p.source,'trail',coalesce((select jsonb_agg(jsonb_build_array(t.latitude,t.longitude) order by t.recorded_at,t.seq)
 from (select latitude,longitude,recorded_at,seq from public.tracking_points where session_id=sess.id
 and recorded_at>now()-interval '5 minutes' order by recorded_at desc,seq desc limit 60) t),'[]'::jsonb)) order by b.name),'[]'::jsonb)
 from public.tracking_sessions sess join public.boats b on b.id=sess.boat_id
 join lateral(select * from public.tracking_points where session_id=sess.id order by recorded_at desc,seq desc limit 1) p on true
 where sess.series_id=p_series and public.series_tracking_open(p_series) and sess.stopped_at is null and sess.expires_at>now()
 and public.tracking_entry_visible(sess.series_id,sess.boat_id)
 -- Removing a boat editor immediately removes their live feed, including while offline.
 and public.can_track_series_boat(sess.series_id,b.id,sess.user_id);
$$;

create or replace function public.public_regatta_replay(p_series uuid,p_at timestamptz) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('boatId',b.id,'boatName',b.name,'recordedAt',p.recorded_at,
 'latitude',p.latitude,'longitude',p.longitude,'accuracyM',p.accuracy_m,'sogMps',p.sog_mps,'cogDeg',p.cog_deg,
 'source',p.source,'trail',coalesce((select jsonb_agg(jsonb_build_array(t.latitude,t.longitude) order by t.recorded_at,t.seq)
 from (select latitude,longitude,recorded_at,seq from public.tracking_points where session_id=sess.id
 and recorded_at between p_at-interval '5 minutes' and p_at order by recorded_at desc,seq desc limit 60) t),'[]'::jsonb)) order by b.name),'[]'::jsonb)
 from public.tracking_sessions sess join public.boats b on b.id=sess.boat_id
 join lateral(select * from public.tracking_points where session_id=sess.id and recorded_at<=p_at order by recorded_at desc,seq desc limit 1) p on true
 where sess.series_id=p_series and sess.replay_enabled and p_at<=now()
 and p_at between sess.started_at and least(sess.expires_at,coalesce(sess.stopped_at,sess.expires_at))
 and public.tracking_entry_visible(sess.series_id,sess.boat_id)
 and public.can_track_series_boat(sess.series_id,b.id,sess.user_id);
$$;

create or replace function public.public_regatta_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(d || jsonb_build_object(
 'firstDate',(select min(race_date) from public.races where series_id=(d->>'id')::uuid and status in ('published','locked')),
 'lastDate',(select max(race_date) from public.races where series_id=(d->>'id')::uuid and status in ('published','locked')),
 'liveBoats',(select count(*) from jsonb_array_elements(public.public_tracking_positions((d->>'id')::uuid)) p where (p->>'recordedAt')::timestamptz > now()-interval '60 seconds'),
 'replayStart',bounds.first_point,'replayEnd',bounds.last_point)),'[]'::jsonb)
 from jsonb_array_elements(public.public_series_directory()) d
 left join lateral (
 select min(p.recorded_at) first_point,max(p.recorded_at) last_point
 from public.tracking_sessions sess join public.boats b on b.id=sess.boat_id
 join public.tracking_points p on p.session_id=sess.id
 where sess.series_id=(d->>'id')::uuid and sess.replay_enabled
 and p.recorded_at between sess.started_at and least(now(),sess.expires_at,coalesce(sess.stopped_at,sess.expires_at))
 and public.tracking_entry_visible(sess.series_id,sess.boat_id)
 and public.can_track_series_boat(sess.series_id,b.id,sess.user_id)
 ) bounds on true;
$$;
create function public.take_over_tracking_session(p_id uuid,p_series uuid,p_boat uuid,p_replay boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
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
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('invite_boat_skipper','boat_invitation_roster','revoke_boat_access','boat_invitation_preview','accept_boat_invitation','prepare_boat_invitation_email','mark_boat_invitation_sent','set_tracking_window','tracking_window','my_boats','can_track_series_boat','series_tracking_open','take_over_tracking_session') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if f.proname not in ('mark_boat_invitation_sent','can_track_series_boat','series_tracking_open') then execute format('grant execute on function %s to authenticated',f.signature); end if;
 if f.proname='boat_invitation_preview' then execute format('grant execute on function %s to anon',f.signature); end if;
 if f.proname='mark_boat_invitation_sent' and exists(select 1 from pg_roles where rolname='service_role') then execute format('grant execute on function %s to service_role',f.signature); end if;
 end loop;
end; $$;
