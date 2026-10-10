-- Include the published course for the invited race, without exposing other races.
create or replace function public.race_phone_info(lid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('linkId',l.id,'boatId',b.id,'boatName',b.name,'seriesId',e.series_id,'seriesName',s.name,
 'course',case when exists(select 1 from jsonb_array_elements(s.document->'races') h where coalesce(h->>'eventId',h->>'id')=e.event_id::text and h->>'status' in ('published','locked')) then s.document->'courses'->e.event_id::text else null end,
 'seriesLinkId',l.series_link_id,'eventId',e.id,'raceName',e.name,'scheduledStart',e.scheduled_start,'expiresAt',e.expires_at,
 'eligible',public.race_phone_entry(e.id,b.id) and (l.series_link_id is null or coalesce((private.series_phone_info(l.series_link_id)->>'valid')::boolean,false)),'active',exists(select 1 from public.race_tracking_windows w where w.event_id=e.id and w.closed_at is null) and e.expires_at>now(),
 'completed',coalesce((select (item->>'completed')::boolean from jsonb_array_elements(s.document->'events') item where item->>'id'=e.event_id::text),false),
 'endedAt',e.ended_at,'valid',(l.series_link_id is null or coalesce((private.series_phone_info(l.series_link_id)->>'valid')::boolean,false)) and l.revoked_at is null and e.ended_at is null and e.expires_at>now())
 from public.race_tracking_links l join public.race_tracking_events e on e.id=l.event_id join public.boats b on b.id=l.boat_id join public.series s on s.id=e.series_id where l.id=lid;
$$;
