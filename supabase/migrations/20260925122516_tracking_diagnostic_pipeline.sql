-- Backward-compatible technical pipeline counters; no coordinates, IDs, or raw logs.
create or replace function public.submit_diagnostics(reports jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare r jsonb; k text; n integer:=0; install uuid; extra jsonb; field text; allowed text[]:=array[
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
  if not (r ?& allowed) then raise exception 'Unexpected report fields'; end if;
  for k in select jsonb_object_keys(r) loop
   if not k=any(allowed || array['pipeline','native']) then raise exception 'Unexpected report field'; end if;
  end loop;
  if not (r->>'consent'=any(array['automatic','manual'])) or not (r->>'event'=any(array['health','gps_restart','gps_error','upload_error','manual','app_state']))
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

  if r ? 'pipeline' and r->'pipeline' <> 'null'::jsonb then
   extra:=r->'pipeline';
   if jsonb_typeof(extra) is distinct from 'object' then raise exception 'Invalid pipeline object'; end if;
   if not (extra ?& array['foregroundCallbackAgeSeconds','backgroundCallbackAgeSeconds','taskCallbackAgeSeconds','batchSize','deliveryDelayMs','rejectedFixes','backgroundRequested','precisePermission','storageAvailable']) or (select count(*) from jsonb_object_keys(extra))<>9 then raise exception 'Unexpected pipeline fields'; end if;
   for field in select jsonb_object_keys(extra) loop
    if field=any(array['foregroundCallbackAgeSeconds','backgroundCallbackAgeSeconds','taskCallbackAgeSeconds','batchSize','deliveryDelayMs','rejectedFixes']) then
     if jsonb_typeof(extra->field)='null' then continue; end if;
     if jsonb_typeof(extra->field) is distinct from 'number' then raise exception 'Invalid pipeline number'; end if;
     if (extra->>field)::numeric<0 or (extra->>field)::numeric>10000000 then raise exception 'Invalid pipeline number'; end if;
    elsif field=any(array['backgroundRequested','precisePermission','storageAvailable']) then
     if jsonb_typeof(extra->field) not in ('boolean','null') then raise exception 'Invalid pipeline boolean'; end if;
    else raise exception 'Unexpected pipeline field'; end if;
   end loop;
  end if;

  if r ? 'native' and r->'native' <> 'null'::jsonb then
   extra:=r->'native';
   if jsonb_typeof(extra) is distinct from 'object' then raise exception 'Invalid native object'; end if;
   if not (extra ?& array['windowAgeSeconds','lastFixDelayMs','pendingJobs','quotaBlockedJobs','registeredCount','registeredScreenOffCount','registeredAgeSeconds','requestAcceptedCount','requestAcceptedScreenOffCount','requestAcceptedAgeSeconds','requestFailedCount','requestFailedScreenOffCount','requestFailedAgeSeconds','broadcastCount','broadcastScreenOffCount','broadcastAgeSeconds','fixCount','fixScreenOffCount','fixAgeSeconds','jobScheduledCount','jobScheduledScreenOffCount','jobScheduledAgeSeconds','jobStartedCount','jobStartedScreenOffCount','jobStartedAgeSeconds','taskDispatchedCount','taskDispatchedScreenOffCount','taskDispatchedAgeSeconds','taskFinishedCount','taskFinishedScreenOffCount','taskFinishedAgeSeconds','serviceStartedCount','serviceStartedScreenOffCount','serviceStartedAgeSeconds','serviceStoppedCount','serviceStoppedScreenOffCount','serviceStoppedAgeSeconds','enabled','serviceRunning','screenInteractive','powerSave','deviceIdle','batteryExempt','gpsProviderEnabled','networkProviderEnabled']) or (select count(*) from jsonb_object_keys(extra))<>45 then raise exception 'Unexpected native fields'; end if;
   for field in select jsonb_object_keys(extra) loop
    if field=any(array['windowAgeSeconds','lastFixDelayMs','pendingJobs','quotaBlockedJobs','registeredCount','registeredScreenOffCount','registeredAgeSeconds','requestAcceptedCount','requestAcceptedScreenOffCount','requestAcceptedAgeSeconds','requestFailedCount','requestFailedScreenOffCount','requestFailedAgeSeconds','broadcastCount','broadcastScreenOffCount','broadcastAgeSeconds','fixCount','fixScreenOffCount','fixAgeSeconds','jobScheduledCount','jobScheduledScreenOffCount','jobScheduledAgeSeconds','jobStartedCount','jobStartedScreenOffCount','jobStartedAgeSeconds','taskDispatchedCount','taskDispatchedScreenOffCount','taskDispatchedAgeSeconds','taskFinishedCount','taskFinishedScreenOffCount','taskFinishedAgeSeconds','serviceStartedCount','serviceStartedScreenOffCount','serviceStartedAgeSeconds','serviceStoppedCount','serviceStoppedScreenOffCount','serviceStoppedAgeSeconds']) then
     if jsonb_typeof(extra->field)='null' then continue; end if;
     if jsonb_typeof(extra->field) is distinct from 'number' then raise exception 'Invalid native number'; end if;
     if (extra->>field)::numeric<0 or (extra->>field)::numeric>10000000 then raise exception 'Invalid native number'; end if;
    elsif field=any(array['enabled','serviceRunning','screenInteractive','powerSave','deviceIdle','batteryExempt','gpsProviderEnabled','networkProviderEnabled']) then
     if jsonb_typeof(extra->field) not in ('boolean','null') then raise exception 'Invalid native boolean'; end if;
    else raise exception 'Unexpected native field'; end if;
   end loop;
  end if;
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

