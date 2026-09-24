-- The creation-request-email Edge Function reads requests through the Data API.
-- Explicitly grant only the read permission it needs; mutations use guarded RPCs.
grant select on public.series_access_requests to service_role;
