alter table public.race_tracking_links add column email_attempt_at timestamptz, add column email_sent_at timestamptz;
create function public.race_invitation_recipients(sid uuid,bid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_official(sid) or not exists(select 1 from public.series_entries where series_id=sid and boat_id=bid) then raise exception 'Race official required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email) order by u.email),'[]'::jsonb)
 from auth.users u join public.boats b on b.id=bid
 where u.email is not null and (u.id=b.owner_id or exists(select 1 from public.boat_members m where m.boat_id=bid and m.user_id=u.id and m.role='editor')));
end; $$;
create function public.prepare_race_invitation_email(token text,recipient_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.race_tracking_links; e public.race_tracking_events; recipient text;
begin
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
create function public.mark_race_invitation_sent(invitation_id uuid) returns void language sql security definer set search_path='' as $$
 update public.race_tracking_links set email_sent_at=now() where id=invitation_id;
$$;
revoke all on function public.race_invitation_recipients(uuid,uuid),public.prepare_race_invitation_email(text,uuid),public.mark_race_invitation_sent(uuid) from public,anon,authenticated;
grant execute on function public.race_invitation_recipients(uuid,uuid),public.prepare_race_invitation_email(text,uuid) to authenticated;
grant execute on function public.mark_race_invitation_sent(uuid) to service_role;
