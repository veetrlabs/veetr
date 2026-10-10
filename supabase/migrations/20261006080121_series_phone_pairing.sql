-- Series capabilities pair a phone once; child capabilities retain race-scoped
-- readiness, tracking windows, expiry and replay. Existing links are not upgraded.
create table public.series_tracking_links (
 id uuid primary key default gen_random_uuid(),
 series_id uuid not null references public.series on delete cascade,
 boat_id uuid not null references public.boats on delete cascade,
 token_hash text not null unique,
 device_hash text,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 email_attempt_at timestamptz,
 email_sent_at timestamptz
);
create unique index series_tracking_one_link on public.series_tracking_links(series_id,boat_id) where revoked_at is null;
alter table public.series_tracking_links enable row level security;
revoke all on public.series_tracking_links from anon,authenticated;
alter table public.race_tracking_links add column series_link_id uuid references public.series_tracking_links on delete cascade;
create unique index series_tracking_one_race_link on public.race_tracking_links(series_link_id,event_id) where revoked_at is null;

-- Internal helpers are not exposed as RPCs. Public guest endpoints below verify
-- an unguessable invitation or the paired device secret instead of auth.uid().
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create function private.series_phone_info(lid uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('scope','series','linkId',l.id,'boatId',l.boat_id,'boatName',b.name,
 'seriesId',s.id,'seriesName',s.name,'connected',l.device_hash is not null,
 'valid',l.revoked_at is null and exists(select 1 from public.series_entries where series_id=s.id and boat_id=l.boat_id),
 'races',coalesce((select jsonb_agg(jsonb_build_object('eventId',r->>'id','raceName',r->>'name','scheduledStart',r->>'scheduledStart') order by r->>'scheduledStart',r->>'id')
 from jsonb_array_elements(coalesce(s.document->'events',s.document->'races')) r
 left join public.race_tracking_events e on e.series_id=s.id and e.event_id::text=r->>'id'
 where nullif(r->>'scheduledStart','')::timestamptz+interval '18 hours'>now()
 and not coalesce((r->>'completed')::boolean,false) and e.ended_at is null
 and exists(select 1 from jsonb_array_elements(s.document->'races') h
 where coalesce(h->>'eventId',h->>'id')=r->>'id' and h->>'status' in ('published','locked') and (h->'entries') ? l.boat_id::text)), '[]'::jsonb))
 from public.series_tracking_links l join public.series s on s.id=l.series_id join public.boats b on b.id=l.boat_id where l.id=lid;
$$;

create function public.create_series_tracking_link(sid uuid,bid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare secret text; lid uuid;
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 perform 1 from public.boats where id=bid for update;
 if not exists(select 1 from public.series_entries where series_id=sid and boat_id=bid) then raise exception 'Boat is not in this series'; end if;
 -- Replacement is an explicit revoke followed by create, never an accidental rotation.
 if exists(select 1 from public.series_tracking_links where series_id=sid and boat_id=bid and revoked_at is null) then raise exception 'A series invitation already exists. Cancel it before creating a replacement.'; end if;
 secret=gen_random_uuid()::text||gen_random_uuid()::text;
 insert into public.series_tracking_links(series_id,boat_id,token_hash) values(sid,bid,public.race_phone_hash(secret)) returning id into lid;
 return jsonb_build_object('id',lid,'token',secret);
end; $$;

create function public.series_tracking_roster(sid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'boatId',l.boat_id,'connected',l.device_hash is not null) order by l.created_at),'[]'::jsonb)
 from public.series_tracking_links l join public.series_entries se on se.series_id=l.series_id and se.boat_id=l.boat_id where l.series_id=sid and l.revoked_at is null);
end; $$;

create function public.revoke_series_tracking_link(lid uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.series_tracking_links;
begin
 select * into l from public.series_tracking_links where id=lid for update;
 if l.id is null or not public.is_official(l.series_id) then raise exception 'Race official required'; end if;
 update public.series_tracking_links set revoked_at=coalesce(revoked_at,now()) where id=lid;
 update public.race_tracking_links set revoked_at=coalesce(revoked_at,now()) where series_link_id=lid;
 update public.race_phone_sessions set stopped_at=coalesce(stopped_at,now()) where link_id in(select id from public.race_tracking_links where series_link_id=lid);
end; $$;

-- A separate preview API lets older apps continue to treat series tokens as
-- unsupported, instead of mistaking a series capability for a race capability.
create function public.preview_tracking_invitation(token text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select private.series_phone_info(id) from public.series_tracking_links where token_hash=public.race_phone_hash(token) and revoked_at is null),public.preview_race_tracking_link(token));
$$;
create function public.claim_series_tracking_link(token text,device_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.series_tracking_links;
begin
 if device_secret is null or length(device_secret)<64 or length(device_secret)>200 then raise exception 'Invalid phone credential'; end if;
 select * into l from public.series_tracking_links where token_hash=public.race_phone_hash(token) for update;
 if l.id is null or not coalesce((private.series_phone_info(l.id)->>'valid')::boolean,false) then raise exception 'Invitation expired or revoked'; end if;
 if l.device_hash is not null and l.device_hash<>public.race_phone_hash(device_secret) then raise exception 'This invitation is already connected to another phone. Ask the referee for a new link.'; end if;
 update public.series_tracking_links set device_hash=public.race_phone_hash(device_secret) where id=l.id;
 return private.series_phone_info(l.id);
end; $$;
create function public.series_phone_status(lid uuid,device_secret text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.series_tracking_links where id=lid and device_hash=public.race_phone_hash(device_secret)) then raise exception 'Invalid phone credential'; end if;
 return private.series_phone_info(lid);
end; $$;

create function public.connect_series_race_phone(lid uuid,device_secret text,event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.series_tracking_links; race jsonb; eid uuid; child_id uuid;
begin
 select * into l from public.series_tracking_links where id=lid for update;
 if l.id is null or l.device_hash is null or device_secret is null or l.device_hash<>public.race_phone_hash(device_secret) then raise exception 'Invalid phone credential'; end if;
 if not (private.series_phone_info(lid)->>'valid')::boolean then raise exception 'Invitation expired or revoked'; end if;
 select r into race from jsonb_array_elements(private.series_phone_info(lid)->'races') r where r->>'eventId'=event_id::text;
 if race is null then raise exception 'Boat is not eligible for this race'; end if;
 if (race->>'scheduledStart')::timestamptz>now()+interval '12 hours' then raise exception 'You can get ready from 12 hours before the scheduled start'; end if;
 -- This capability may configure only a published race containing its own boat.
 insert into public.race_tracking_events(series_id,event_id,name,scheduled_start,expires_at)
 values(l.series_id,connect_series_race_phone.event_id,race->>'raceName',(race->>'scheduledStart')::timestamptz,(race->>'scheduledStart')::timestamptz+interval '18 hours')
 on conflict on constraint race_tracking_events_series_id_event_id_key do nothing;
 select id into eid from public.race_tracking_events e where e.series_id=l.series_id and e.event_id=connect_series_race_phone.event_id for update;
 if not exists(select 1 from public.race_tracking_events where id=eid and ended_at is null and expires_at>now()) then raise exception 'Race tracking has ended'; end if;
 perform 1 from public.boats where id=l.boat_id for update;
 select id into child_id from public.race_tracking_links where series_link_id=lid and race_tracking_links.event_id=eid and revoked_at is null;
 if child_id is null then
  insert into public.race_tracking_links(event_id,boat_id,token_hash,device_hash,series_link_id)
  values(eid,l.boat_id,public.race_phone_hash(gen_random_uuid()::text||gen_random_uuid()::text),l.device_hash,lid) returning id into child_id;
 end if;
 return public.race_phone_info(child_id);
end; $$;

-- Race roster includes a paired series phone even before it gets ready for that race.
create or replace function public.race_tracking_roster(sid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_official(sid) then raise exception 'Race official required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'eventId',e.event_id,'name',e.name,
 'scheduledStart',e.scheduled_start,'expiresAt',e.expires_at,'endedAt',e.ended_at,
 'active',exists(select 1 from public.race_tracking_windows w where w.event_id=e.id and w.closed_at is null) and e.expires_at>now(),
 'phones',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'boatId',p.boat_id,'connected',p.connected,'ready',p.ready,'lastSeen',p.seen_at,'eligible',public.race_phone_entry(e.id,p.boat_id))),'[]'::jsonb)
 from (select distinct on (boat_id) * from (
  select l.id,l.boat_id,l.device_hash is not null as connected,ps.id is not null as ready,ps.seen_at,l.series_link_id is not null as series_pairing,l.created_at
  from public.race_tracking_links l left join public.race_phone_sessions ps on ps.link_id=l.id and ps.stopped_at is null
  where l.event_id=e.id and l.revoked_at is null
  union all
  select l.id,l.boat_id,l.device_hash is not null,false,null::timestamptz,true,l.created_at
  from public.series_tracking_links l join public.series_entries se on se.series_id=l.series_id and se.boat_id=l.boat_id
  where l.series_id=sid and l.revoked_at is null
 ) candidates order by boat_id,ready desc,connected desc,series_pairing desc,created_at desc,id) p)
 ) order by e.scheduled_start,e.id),'[]'::jsonb) from public.race_tracking_events e where e.series_id=sid);
end; $$;

create function public.prepare_series_invitation_email(token text,recipient_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.series_tracking_links; recipient text;
begin
 select * into l from public.series_tracking_links where token_hash=public.race_phone_hash(token) for update;
 if l.id is null or not public.is_official(l.series_id) then raise exception 'Race official required'; end if;
 if not (private.series_phone_info(l.id)->>'valid')::boolean then raise exception 'Invitation expired or revoked'; end if;
 select r->>'email' into recipient from jsonb_array_elements(public.race_invitation_recipients(l.series_id,l.boat_id)) r where r->>'id'=recipient_id::text;
 if recipient is null then raise exception 'Choose a configured boat administrator'; end if;
 if l.email_attempt_at>now()-interval '60 seconds' then raise exception 'Wait a minute before retrying email'; end if;
 update public.series_tracking_links set email_attempt_at=now() where id=l.id;
 return jsonb_build_object('id',l.id,'email',recipient,'token',token,'boat',(select name from public.boats where id=l.boat_id),'series',(select name from public.series where id=l.series_id),'deliveryKey',gen_random_uuid());
end; $$;
create function public.mark_series_invitation_sent(invitation_id uuid) returns void language sql security definer set search_path='' as $$
 update public.series_tracking_links set email_sent_at=now() where id=invitation_id;
$$;

revoke all on function private.series_phone_info(uuid) from public,anon,authenticated;
revoke all on function public.create_series_tracking_link(uuid,uuid),public.series_tracking_roster(uuid),public.revoke_series_tracking_link(uuid),public.preview_tracking_invitation(text),public.claim_series_tracking_link(text,text),public.series_phone_status(uuid,text),public.connect_series_race_phone(uuid,text,uuid),public.race_tracking_roster(uuid),public.prepare_series_invitation_email(text,uuid),public.mark_series_invitation_sent(uuid) from public,anon,authenticated;
grant execute on function public.create_series_tracking_link(uuid,uuid),public.series_tracking_roster(uuid),public.revoke_series_tracking_link(uuid),public.race_tracking_roster(uuid),public.prepare_series_invitation_email(text,uuid) to authenticated;
grant execute on function public.preview_tracking_invitation(text),public.claim_series_tracking_link(text,text),public.series_phone_status(uuid,text),public.connect_series_race_phone(uuid,text,uuid) to anon,authenticated;
grant execute on function public.mark_series_invitation_sent(uuid) to service_role;

-- Removing a boat from a series also disables its child race capabilities.
create or replace function public.race_phone_info(lid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('linkId',l.id,'boatId',b.id,'boatName',b.name,'seriesId',e.series_id,'seriesName',s.name,
 'seriesLinkId',l.series_link_id,'eventId',e.id,'raceName',e.name,'scheduledStart',e.scheduled_start,'expiresAt',e.expires_at,
 'eligible',public.race_phone_entry(e.id,b.id) and (l.series_link_id is null or coalesce((private.series_phone_info(l.series_link_id)->>'valid')::boolean,false)),'active',exists(select 1 from public.race_tracking_windows w where w.event_id=e.id and w.closed_at is null) and e.expires_at>now(),
 'completed',coalesce((select (item->>'completed')::boolean from jsonb_array_elements(s.document->'events') item where item->>'id'=e.event_id::text),false),
 'endedAt',e.ended_at,'valid',(l.series_link_id is null or coalesce((private.series_phone_info(l.series_link_id)->>'valid')::boolean,false)) and l.revoked_at is null and e.ended_at is null and e.expires_at>now())
 from public.race_tracking_links l join public.race_tracking_events e on e.id=l.event_id join public.boats b on b.id=l.boat_id join public.series s on s.id=e.series_id where l.id=lid;
$$;
