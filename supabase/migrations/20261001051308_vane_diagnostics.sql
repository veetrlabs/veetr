-- Explicit support submissions. Reuses the private, 30-day diagnostic store.
-- The definer endpoint permits bounded anonymous submissions, never reads or edits.
create function public.submit_vane_diagnostic(report jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare k text; s jsonb; v numeric; rid uuid; install uuid; occurred timestamptz;
 allowed text[]:=array['id','installationId','occurredAt','firmware','appVersion','samples'];
 fields text[]:=array['up','imu','q','a','age','quality','north','offset','raw','hdg','rej','gps','sat'];
begin
 if jsonb_typeof(report) is distinct from 'object' or octet_length(report::text)>12000 then raise exception 'Invalid report'; end if;
 if (select count(*) from jsonb_object_keys(report))<>6 then raise exception 'Unexpected fields'; end if;
 for k in select jsonb_object_keys(report) loop
  if not k=any(allowed) then raise exception 'Unexpected field'; end if;
 end loop;
 foreach k in array array['id','installationId','occurredAt','firmware','appVersion'] loop
  if jsonb_typeof(report->k) is distinct from 'string' or length(report->>k)>80 then raise exception 'Invalid string'; end if;
 end loop;
 foreach k in array array['firmware','appVersion'] loop
  if report->>k !~ '^v?[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$' then raise exception 'Invalid version'; end if;
 end loop;
 rid:=(report->>'id')::uuid; install:=(report->>'installationId')::uuid; occurred:=(report->>'occurredAt')::timestamptz;
 if not isfinite(occurred) or occurred<now()-interval '30 days' or occurred>now()+interval '5 minutes' then raise exception 'Invalid time'; end if;
 if jsonb_typeof(report->'samples') is distinct from 'array' then raise exception 'Invalid samples'; end if;
 if jsonb_array_length(report->'samples') not between 1 and 15 then raise exception 'Invalid sample count'; end if;
 for s in select value from jsonb_array_elements(report->'samples') loop
  if jsonb_typeof(s) is distinct from 'object' then raise exception 'Invalid sample'; end if;
  if (select count(*) from jsonb_object_keys(s))<>13 then raise exception 'Unexpected sample fields'; end if;
  for k in select jsonb_object_keys(s) loop
   if not k=any(fields) then raise exception 'Unexpected sample field'; end if;
   if k=any(array['imu','north','gps']) then
    if jsonb_typeof(s->k) is distinct from 'boolean' then raise exception 'Invalid boolean'; end if;
   else
    if k='raw' and jsonb_typeof(s->k)='null' then continue; end if;
    if jsonb_typeof(s->k) is distinct from 'number' then raise exception 'Invalid number'; end if;
    v:=(s->>k)::numeric;
    if k=any(array['offset','raw','hdg']) then
     if v < -360 or v > 360 then raise exception 'Invalid angle'; end if;
    elsif v < (case when k='age' then -1 else 0 end) or v>4294967295 or v<>trunc(v) then raise exception 'Invalid counter';
    end if;
    if k='quality' and v>3 or k='sat' and v>255 then raise exception 'Invalid status'; end if;
   end if;
  end loop;
 end loop;
 perform pg_advisory_xact_lock(824095103);
 if exists(select 1 from public.diagnostic_reports where id=rid) then
  if exists(select 1 from public.diagnostic_reports where id=rid and installation_id=install and payload=report || '{"event":"vane","consent":"manual"}'::jsonb) then return rid; end if;
  raise exception 'Report conflict';
 end if;
 if (select count(*) from public.diagnostic_reports where received_at>now()-interval '1 day')>=100000
 or (select count(*) from public.diagnostic_reports where installation_id=install and received_at>now()-interval '1 day' and payload->>'event'='vane')>=30 then raise exception 'Diagnostic quota reached'; end if;
 insert into public.diagnostic_reports(id,installation_id,occurred_at,payload) values(rid,install,occurred,report || '{"event":"vane","consent":"manual"}'::jsonb);
 return rid;
end; $$;
revoke all on function public.submit_vane_diagnostic(jsonb) from public;
grant execute on function public.submit_vane_diagnostic(jsonb) to anon,authenticated;
