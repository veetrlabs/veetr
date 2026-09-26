-- Optional telemetry: never join these pseudonymous reports to account/race tables.
create table public.diagnostic_reports (
 id uuid primary key,
 installation_id uuid not null,
 received_at timestamptz not null default now(),
 occurred_at timestamptz not null,
 payload jsonb not null
);
create index diagnostic_reports_retention on public.diagnostic_reports(received_at);
create index diagnostic_reports_rate on public.diagnostic_reports(installation_id,received_at);
alter table public.diagnostic_reports enable row level security;
revoke all on public.diagnostic_reports from public,anon,authenticated;
grant select,delete on public.diagnostic_reports to service_role;

create function public.submit_diagnostics(reports jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare r jsonb; k text; n integer:=0; install uuid; allowed text[]:=array[
'id','installationId','occurredAt','consent','event','appVersion','build','platform','osVersion','model',
'state','foregroundPermission','backgroundPermission','tracking','fixAgeSeconds','uploadAgeSeconds',
'accuracyM','pendingCount','recoveryCount','errorCode'];
begin
 if jsonb_typeof(reports) is distinct from 'array' then raise exception 'Invalid reports'; end if;
 if jsonb_array_length(reports) not between 1 and 20 or octet_length(reports::text)>40000 then raise exception 'Report batch too large'; end if;
 -- Serializes rate checks so concurrent anonymous requests cannot overrun the cap.
 perform pg_advisory_xact_lock(824095103);
 if (select count(*) from public.diagnostic_reports where received_at>now()-interval '1 day')>=100000 then raise exception 'Diagnostic quota reached'; end if;
 for r in select value from jsonb_array_elements(reports) loop
  if jsonb_typeof(r) is distinct from 'object' then raise exception 'Invalid report'; end if;
  if (select count(*) from jsonb_object_keys(r))<>array_length(allowed,1) then raise exception 'Unexpected report fields'; end if;
  for k in select jsonb_object_keys(r) loop
   if not k=any(allowed) then raise exception 'Unexpected report field'; end if;
  end loop;
  if not (r->>'consent'=any(array['automatic','manual'])) or not (r->>'event'=any(array['health','gps_restart','gps_error','upload_error','manual']))
   or not (r->>'platform'=any(array['android','ios','web']))
   or not (r->>'state'=any(array['active','background','inactive','unknown']))
   or not (r->>'tracking'=any(array['starting','recording','stopping','none']))
   or not (r->>'foregroundPermission'=any(array['granted','denied','undetermined']))
   or not (r->>'backgroundPermission'=any(array['granted','denied','undetermined']))
   or not (r->>'errorCode'=any(array['none','permission','network','gps','tracking'])) then raise exception 'Invalid diagnostic category'; end if;
  foreach k in array array['consent','event','platform','state','tracking','foregroundPermission','backgroundPermission','errorCode','appVersion','build','osVersion','model','id','installationId','occurredAt'] loop
   if jsonb_typeof(r->k) is distinct from 'string' or length(r->>k)>80 then raise exception 'Invalid diagnostic string'; end if;
  end loop;
  foreach k in array array['fixAgeSeconds','uploadAgeSeconds','accuracyM','pendingCount','recoveryCount'] loop
   if jsonb_typeof(r->k)='null' and k=any(array['fixAgeSeconds','uploadAgeSeconds','accuracyM']) then continue; end if;
   if jsonb_typeof(r->k) is distinct from 'number' then raise exception 'Invalid diagnostic number'; end if;
   if (r->>k)::numeric<0 or (r->>k)::numeric>10000000 then raise exception 'Invalid diagnostic number'; end if;
  end loop;
  if (r->>'occurredAt')::timestamptz<now()-interval '7 days' or (r->>'occurredAt')::timestamptz>now()+interval '5 minutes' then raise exception 'Invalid report time'; end if;
  install:=(r->>'installationId')::uuid;
  if (select count(*) from public.diagnostic_reports where installation_id=install and received_at>now()-interval '1 day')>=2000 then raise exception 'Diagnostic quota reached'; end if;
  insert into public.diagnostic_reports(id,installation_id,occurred_at,payload)
   values((r->>'id')::uuid,install,(r->>'occurredAt')::timestamptz,r) on conflict(id) do nothing;
  n:=n+1;
 end loop;
 return n;
end; $$;
revoke all on function public.submit_diagnostics(jsonb) from public;
grant execute on function public.submit_diagnostics(jsonb) to anon,authenticated;

create function public.purge_diagnostics() returns void
language sql security definer set search_path='' as $$
 delete from public.diagnostic_reports where received_at < now()-interval '30 days';
$$;
revoke all on function public.purge_diagnostics() from public,anon,authenticated;
grant execute on function public.purge_diagnostics() to service_role;
-- PGlite test databases have no extensions; hosted/local Postgres installs pg_cron.
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
  perform cron.schedule('veetr-diagnostics-retention','17 * * * *','select public.purge_diagnostics()');
 end if;
end $$;
