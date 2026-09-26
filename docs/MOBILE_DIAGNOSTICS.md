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

## Android location pipeline diagnostics

The checked-in `app/patches/expo-location+19.0.8.patch` adds observational counters to the exact installed Expo Location version. `postinstall` applies it with `patch-package --error-on-fail`; upgrades must explicitly rebase/review this patch. Android autolinking forces `expo-location` to build from source so a precompiled AAR cannot bypass the patch. It does not change location requests, hold wake locks, or restart services. A new native Android binary is required; older binaries return `native: null`.

Native collection is off by default. The existing reporting choice is copied to native SharedPreferences at app startup and when toggled. Disabling clears native counters. Counters are bounded, reset on the first event after 24 hours, and excluded from snapshots once expired. They survive JavaScript suspension and process restart, but cannot observe events if the entire process is stopped. SharedPreferences writes are asynchronous and therefore not a crash-proof trace.

Reports add a strictly validated `native` object: counts, screen-off counts, and last-event ages for registration, provider request acceptance/failure, broadcasts, fixes, job scheduling attempts, job starts, task dispatch/completion, and service starts/destruction. They also contain fix delivery delay, current service/screen/provider/power flags, pending task jobs, and (Android 16+) quota-blocked jobs. `serviceRunning` is an in-process observation set after startForeground succeeds and cleared on destruction; it is not a system guarantee. Native counters describe an opt-in window, not a particular trip. No identifiers or raw native messages are recorded.

The `pipeline` object adds foreground/task/background callback ages, most recent callback batch size/delay, rejected-fix count for that batch, precise permission, recording-storage availability, and requested background status. A storage failure still permits diagnostic submission. `backgroundRequested` is task registration state, not proof of native service readiness. App-state reports preserve the trigger's state; native flags describe the later snapshot time. Health snapshots follow persistence, so fix age is not sampled just before the same fix is saved. Upload batches are kept below the server size cap.

### Next physical-device test

1. Install the diagnostic binary and enable automatic reports before starting the trip.
2. Send a manual baseline report; record outdoors for two minutes with the screen on.
3. Lock the screen for five minutes while continuing to walk, then unlock. Note the lock/unlock times.
4. Keep recording for one further minute, then send a manual report before stopping. Keep the trip export for comparison.
5. Compare native counter deltas within the same counter window, including `*ScreenOffCount`. Do not infer physical screen lock solely from app background state.

Interpretation:
- Provider request failures or no successful service start: investigate native service/provider startup.
- No native screen-off fixes: investigate provider delivery/service survival and power state; JavaScript logging cannot explain this alone.
- Native fixes and scheduling attempts increase but job starts do not: investigate JobScheduler; quota-blocked jobs are a useful snapshot, not a complete history.
- Job starts/task dispatch increase but JS callback age stays old: investigate Expo task/JS delivery.
- JS callbacks arrive but saved fix age stays old: inspect rejected fixes, accuracy, timestamp filtering, and storage errors.

Native diagnostics do not fix tracking or guarantee a five-second interval. If counters do not locate the failure, capture device-local adb logcat plus `dumpsys activity services com.veetr.app`, `dumpsys jobscheduler`, and `dumpsys deviceidle` during reproduction. Inspect/filter those logs locally before sharing because Android dumps can include unrelated apps and sensitive data.
