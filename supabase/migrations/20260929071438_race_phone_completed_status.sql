-- Expose the race editor completion checkbox without changing tracking or replay permissions.
create or replace function public.race_phone_info(lid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('linkId',l.id,'boatId',b.id,'boatName',b.name,'seriesId',e.series_id,'seriesName',s.name,
 'eventId',e.id,'raceName',e.name,'scheduledStart',e.scheduled_start,'expiresAt',e.expires_at,
 'eligible',public.race_phone_entry(e.id,b.id),'active',exists(select 1 from public.race_tracking_windows w where w.event_id=e.id and w.closed_at is null) and e.expires_at>now(),
 'completed',coalesce((select (item->>'completed')::boolean from jsonb_array_elements(s.document->'events') item where item->>'id'=e.event_id::text),false),
 'endedAt',e.ended_at,'valid',l.revoked_at is null and e.ended_at is null and e.expires_at>now())
 from public.race_tracking_links l join public.race_tracking_events e on e.id=l.event_id join public.boats b on b.id=l.boat_id join public.series s on s.id=e.series_id where l.id=lid;
$$;
