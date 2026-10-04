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

Native collection is off by default. The existing reporting choice is copied to native SharedPreferences at app startup and when toggled. Disabling clears native counters and history. Counters are bounded cumulative values since consent was enabled; they no longer reset on the first event after 24 hours. The native journal retains up to 1,024 events for seven days (expired rows are pruned on write and excluded on read). They survive JavaScript suspension and process restart, but cannot observe events if the entire process is stopped. SharedPreferences writes are asynchronous and therefore not a crash-proof trace.

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

### September 2026 delayed-batch regression

A CPH2653 / Android 16 / build 19 sea-trip report showed native fixes continuing with the screen off, while task completions stalled. A batch of 1,782 locations reached JavaScript after foreground recording resumed. The store previously rejected every point older than the latest saved fix, discarding the delayed route.

The store now fills gaps using neighbouring saved timestamps for sampling and deduplication. Latest-position state stays at the newest fix. Trip uploads use insertion order for stable sequence numbers; route displays and exports use recording time. The location task is imported from the app entry point so registration does not depend on mounting router layouts.

Regression checks cover two hours of backfill after a fresh foreground fix, duplicate delivery, persistence, sampling boundaries, stop/session isolation, and sharing after backfill. These checks do not establish that Android screen-off task delivery is fixed. Validate a new installed binary on the affected phone with the physical-device procedure above, including locking, unlocking, and reopening before stopping. Previously discarded points cannot be recovered from diagnostic counters, which contain no coordinates.

## Bluetooth connection diagnostics (iOS and Android)

The app retains the latest 20 technical Bluetooth breadcrumbs in memory for up to six hours. Send a diagnostic report after reproducing a connection failure, before closing the app. Automatic reports include these breadcrumbs only when reporting is enabled; a manual report includes them without enabling automatic reporting. Turning reporting off clears the current breadcrumbs as well as unsent reports. Subsequent connection activity can create new local breadcrumbs for a future manual report.

Each breadcrumb contains a connection stage, outcome, last observed adapter state, age, and numeric BLE/iOS/Android/ATT error codes. Stages cover permission, scan, connection, discovery, MTU, service/characteristic lookup, subscription, disconnection, automatic reconnection and provider cleanup. Device names, peripheral identifiers, UUIDs, raw error messages, commands, sensor values and locations are never copied into this history. A connected stage means notification monitoring was registered, not that sensor data has arrived. Null error codes mean the library supplied no valid numeric code.

Apply `20260927111211_bluetooth_diagnostics.sql` before releasing the diagnostic app. The optional `ble` array is validated by the server; old reports without it remain accepted. Existing consent, queue, access restrictions and 30-day server retention remain unchanged. This is instrumentation, not a Bluetooth reconnection fix.

### Reconnection context

`20260927155209_bluetooth_reconnect_context.sql` accepts both older eight-field BLE entries and the new context fields. Deploy it before the updated app. Up to eight errors/disconnects are reserved in the twenty-entry memory history, with the remaining slots filled by recent activity. Consent withdrawal clears both buffers. No history survives an app restart.

Each event captures foreground/background/inactive state (not physical screen-lock state), connected duration, last valid sensor-message age, last RSSI and its age, a format-restricted firmware version, attempt number, direct-versus-scan method and elapsed attempt time. Null means unavailable. Signal strength is sampled every 30 seconds while connected; failed reads do not interrupt BLE. These fields help distinguish reception failures from stopped notifications, but a timeout alone still does not prove the cause.

Recovery tries the last known peripheral directly, with a 15-second native connection timeout. Every third retry scans for Vane's service and matches the same peripheral locally, without putting its identifier in telemetry. Failed retries continue with a delay capped at 30 seconds; successful connections reset the retry counter. iOS may delay execution while the app is suspended. Explicit disconnect and provider cleanup cancel recovery. MTU requests use Android's requestMTU API only; CoreBluetooth manages iOS MTU.


## Persistent Android tracking evidence (September 28)

`trackingHistory` is an optional, strictly validated array alongside the unchanged `native` counters. The native journal writes a checkpoint at most every ten minutes of activity and records trip boundaries, resume/recovery, service lifecycle, job cancellation, process restart, storage failures, and the first event after a >45-second save gap **before** updating callback/save evidence. It cannot emit events while the whole process is dead. On Android 11+, a later process can collect the OS's recent exit reason codes; on Android 16+, it collects pending-job reason history before recovery cancels jobs. These OS histories are limited and are not proof that a particular reason caused the gap.

Each uploaded history entry contains only an event category, relative age, cumulative background-native fixes, JavaScript callback invocations (foreground + task), successfully saved phone-pipeline positions, task starts, time since the last save, numeric OS reason, and nullable screen/quota flags. A successful save means the SQLite transaction completed; duplicate/thinned points do not increment the count. Checkpoint deltas distinguish provider delivery, JS delivery and persistence. Historical OS events have null counters/flags: current observations must not be attributed to a past event. No route, session/task ID, process name, exception text or stack trace enters this history.

Reports include at most 64 entries: up to 32 recent lifecycle/failure events plus evenly sampled checkpoints, retaining the endpoints of the available checkpoint window. This is a sampled diagnostic history, not a complete trip log. Counts saturate at ten million; compare deltas only inside the same consent window. Quota flags are null on unsupported Android versions. No extra wake lock, timer, location request, or foreground-service restart is introduced.

Apply `20260928160017_persistent_tracking_diagnostics.sql` before distributing the new binary. Old clients remain accepted. Android needs a new native build; an OTA JavaScript update cannot add these hooks. Existing binaries and iOS safely return an empty history. Diagnostics remain opt-in; a manual report while collection is off cannot reconstruct historical events. Disabling deletes local history under the existing reporting controls. Server retention remains 30 days. Upload batching uses a conservative UTF-8 size estimate to stay below the existing 40 KB JSONB limit even with a full Bluetooth and tracking history.

Validation: check persistence across process recreation and a gap longer than 24 hours, pre-recovery ordering, successful transaction counts, privacy allowlists, full-report upload size, and the Android Kotlin compile. On-device locked-screen testing is still required; this instrumentation does not itself repair tracking gaps.

Local JVM journal regression checks: `JAVA_HOME=<JDK17> node app/tests/native-diagnostics/run.mjs`. This compiles the actual patched recorder against small Android test doubles using the cached Kotlin compiler/JSON dependency from a prior Android compile. It covers retained counters across the old 24-hour boundary, simulated process recreation, pre-recovery gap evidence, OS reason deduplication, bounded retention and consent deletion. It does not simulate Android scheduling or disk flush guarantees. Run the real `:expo-location:compileReleaseKotlin` task separately for Android API compatibility.

## User-run Vane diagnostics

Bluetooth settings includes **Run Vane diagnostics**. This requires the new
`VANE_DIAGNOSTICS` firmware command on either standard Vane or Vane RLCD;
older firmware times out with an update explanation. The app takes 15 samples
(about 30–60 seconds depending on the device refresh rate). Leaving the screen,
disconnecting, cancelling, or starting a firmware update stops collection.
It never changes calibration, clears sensor state, or writes device preferences.

Results show compass report delivery, sensor quality, whether north alignment
is loaded, recent GPS availability, and the largest circular heading change
between sampled readings. Actual boat movement also changes heading. This is
not a hardware fault diagnosis and cannot capture every jump between samples.
A loaded alignment proves the running device has an alignment, not that it
matches the user's expected calibration. `raw` is the aligned angle before
quality gating, not an uncalibrated magnetic measurement.

Only the latest report is stored locally. Partial results can also be exported
or sent. Export creates JSON; **Send to Veetr** explicitly uploads technical
samples, public app/firmware versions, timestamp, report ID, and a pseudonymous
installation ID. Coordinates, boat/device names and account details are absent.
Automatic app diagnostics consent does not automatically upload these reports.

The `submit_vane_diagnostic` RPC validates a maximum of 15 samples and 12 KB,
limits submissions to 30 per installation per day, and uses the existing global
diagnostic quota. Retries are idempotent for identical reports. Reports remain
private in `diagnostic_reports`, marked `event=vane` and `consent=manual`, and
expire through the existing 30-day purge. Support can find them by report ID.
Failed submissions remain on the phone for retry/export.

Validation: native packet boundaries (180 bytes), both firmware builds, app
request correlation/timeout/cancellation and heading wrap tests, explicit-send
UI tests, and Postgres integration tests for validation, privacy and quotas.
A physical BLE session still needs verification after the firmware and app
releases; compilation and mocked app tests do not verify radio delivery.

The security advisor flags anonymous execution of the definer RPC by design:
it is an explicit support-submission endpoint for users without accounts. The
validation and quotas bound writes; it grants no report-reading capability.
The table's no-policy RLS finding is also intentional (deny direct client access).
See [Supabase's advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
