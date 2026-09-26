# Optional mobile diagnostics

Settings → Location & tracking offers an off-by-default reporting switch and a separate one-off report button. Only allowlisted technical fields are gathered, after consent. The isolated AsyncStorage queue sends with the public Supabase key, never an account JWT. Recording never awaits diagnostic storage or network calls.

Reports exclude coordinates, routes, raw error/console messages, personal device names, account/race IDs and tokens. Automatic reports use a random identifier shown in settings, reset on withdrawal. Manual reports use a separate identifier and display a report UUID for support. Reports are pseudonymous, not anonymous.

At most 100 reports are kept locally, for seven days, in batches of 20. Health reports are limited to one per minute. Requests time out after eight seconds and retry on app activity, periodic runtime checks or connectivity changes. Disabling clears pending reports and aborts uploads where possible; reports already received cannot be recalled by that action. Delivery is best-effort and cannot run while the OS has killed the app.

## Supabase inspection

Authorized maintainers can use the SQL editor. Anonymous and authenticated app users cannot read, update or delete the table; a validated ingestion RPC is their only entry point.

```sql
select received_at, id, installation_id,
 payload->>'model' as model, payload->>'build' as build,
 payload->>'event' as event, payload->>'errorCode' as error,
 payload->>'fixAgeSeconds' as fix_age,
 payload->>'uploadAgeSeconds' as upload_age,
 payload->>'pendingCount' as pending,
 payload->>'recoveryCount' as restarts
from public.diagnostic_reports
where received_at > now() - interval '1 day'
order by received_at desc limit 200;
```

Filter by the report ID or diagnostic ID supplied by a tester. Maintainers can delete matching rows for access/deletion requests. Do not add public read policies or join diagnostic IDs to race/account tables.

## Deployment and retention

Apply `202609240001_optional_diagnostics.sql` before releasing the app. It installs pg_cron where available and schedules hourly deletion of reports received more than 30 days ago. PGlite tests cannot run pg_cron; hosted scheduling must be verified separately:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname = 'veetr-diagnostics-retention';
select status, return_message, end_time from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'veetr-diagnostics-retention')
order by end_time desc limit 5;
```

Ingestion limits: 2,000 reports per random identifier per day, global daily cap of 100,000, 20 reports/request, maximum 40KB batch. Random anonymous IDs are not strong abuse protection; monitor volume and add gateway rate limiting if needed. The diagnostic table excludes IP addresses, but infrastructure request logs/backups have separate provider retention. Confirm processor arrangements and project region; do not promise anonymity or 30-day deletion from all backups.

## Store disclosures before release

Update Google Play Data safety and Apple App Privacy to reflect optional diagnostics for app functionality and the random installation identifier. Review Google Diagnostics / Device or other IDs and Apple Other Diagnostic Data / Device ID against current definitions. No advertising tracking is added. Existing race-location collection must remain separately declared; do not mark the whole app as collecting no location. Supabase is the processing provider.

Store-console declarations are NOT updated by this code change. Privacy notice source: `veetr.org/src/content/pages/privacy.md`. Consent is the basis for this feature; declining or withdrawing does not affect tracking.
