# Phone-based regatta tracking

The first tracking milestone uses the React Native app's phone GPS. It does not require a Veetr device. Existing BLE instrument screens remain separate; selecting Veetr GPS and carrying extra sensor telemetry is a subsequent milestone.

## Participant workflow

1. Create a Veetr account (or set a password for an existing account) at `/account/` on the website.
2. Own a boat or ask its owner to add you as a boat editor. The organizer must register that boat in at least one published heat in the series.
3. In the mobile app, open **Track**, sign in, select the boat and series, and choose **Start sharing location**. The confirmation explains that position, speed and the recent trail become public.
4. Grant foreground and background location permissions. The Android foreground-service notification and the iOS location indicator remain visible during tracking.
5. **Stop sharing** immediately persists a local stop and prevents subsequent callbacks from adding positions. It also asks the server to hide the boat. If offline, the app explicitly shows that the stop is awaiting connection; the public map retains the previous, increasingly stale position until stop confirmation or expiry.

One active session is allowed per boat across all phones and series. A second phone cannot take over silently. Sessions expire after 12 hours. Initial start needs connectivity; reconnecting/retrying an uncertain start reuses the same UUID. Force-closing the app can stop GPS updates; reopening the app resumes the saved session when permissions and authentication permit. Finish a session before signing out. Another account cannot upload or inspect the saved session's points in the app.

## Capture and synchronization

- Request high-accuracy phone fixes approximately every 5 seconds. Reject missing accuracy, accuracy worse than 100 m, nonfinite/out-of-range coordinates, and invalid/future timestamps. Thin callbacks to at most one recorded fix per 5 seconds.
- SOG is the phone GPS speed in metres/second, displayed in knots. Unavailable speed remains unknown, rather than zero. Course over ground is omitted at speeds below 0.5 m/s; it is not the device compass heading.
- Commit fixes to a dedicated SQLite outbox before contacting the network. The queue survives app restarts and is separate from BLE recording and the committee's series-document outbox.
- Target uploads every 20 seconds from native location callbacks, with foreground/reconnection retries. This is not an OS scheduling guarantee. A JavaScript interval alone does not keep an app running in the background.
- Upload up to 120 fixes per transaction. `(session_id, seq)` is the server idempotency key. Delete only acknowledged rows; capture can continue during upload. A failed or partial acknowledgement leaves the batch queued.
- Keep at most 10,000 pending fixes locally (more than a 12-hour session at 5-second sampling). Report storage errors rather than claim a fix was saved. A stop takes priority over draining a backlog.
- After stop, historical fixes may be uploaded until 24 hours after session expiry, but cannot make the session public again. A refused/expired backlog can be explicitly discarded after the server confirms the stop. Clock errors and lost boat permissions appear as upload errors.

## Public live map

Open a series on the website and select **Live map**. The mobile **View live map** button opens `/races/?series=UUID#tracking`. This milestone's fleet map is on the website; the app's existing native Map tab remains the BLE instrument map.

The map shows all consenting boats in the **series**, not positions filtered to an individual heat. It refreshes the public projection every 5 seconds while visible; phone uploads target 20 seconds. The first implementation uses bounded RPC polling so authorization and visibility are checked on each refresh. It does not subscribe to or expose raw GPS tables through Realtime. Broadcast can be added later if spectator volume warrants it.

The latest observation time, not arrival order, determines the current marker. Replayed old fixes cannot rewind a boat. Display a recent five-minute trail (at most 60 points), SOG, course, accuracy, coordinates and last-fix age. Mark reports older than 60 seconds grey. When the feed cannot be refreshed, clear displayed positions and show the retry state. GPS tracks are separate from official finish results.

Leaflet renders the website map using the existing installed mapping library. OpenStreetMap supplies the base tiles; the **Nautical seamarks (OpenSeaMap)** checkbox adds buoys, lights and other available community nautical marks. The overlay does not include depth charts and is not a complete navigational chart. Layer errors leave boat coordinates and the base map available. Attribution stays visible. MapLibre would be a future renderer choice for vector styling/rotation; changing chart providers is a separate decision.

Map requests currently use the public tile endpoints for an initial small deployment. Do not bulk-download or precache map tiles; browser caching should follow the providers' headers. Before larger-scale use, provision an appropriate tile service. References: [OpenSeaMap integration](https://wiki.openseamap.org/wiki/h%3AEn%3AOpenSeaMap_in_Website), [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/), [Expo 54 background location](https://docs.expo.dev/versions/v54.0.0/sdk/location/).

## Backend and rollout

Apply `supabase/migrations/202609130001_boat_tracking.sql` before distributing the new mobile build. It adds `tracking_sessions`, `tracking_points`, and five client RPCs:

| RPC | Access |
| --- | --- |
| `my_tracking_entries` | Signed-in boat owner/editor; only entries in published heats |
| `start_tracking_session` | Boat owner/editor; registered published entry; one reporter per boat |
| `ingest_tracking_points` | Session owner who still owns/edits the registered boat |
| `stop_tracking_session` | Session owner, including after boat permission revocation |
| `public_tracking_positions` | Public projection of active, unexpired, still-authorized sessions |

Both raw tables have RLS enabled and no client table grants. Hiding published heats or removing a boat editor removes their feed on the next map refresh. GPS data never mutates scoring documents, race results, revisions or finish timestamps. Tracking does not provide anti-cheat certification.

The raw track has no participant replay/download API yet. For the initial deployment, operators should purge expired sessions older than seven days; cascading deletion removes their fixes:

```sql
delete from public.tracking_sessions
where expires_at < now() - interval '7 days';
```

There is **no automatic retention job in this migration**. Configure that maintenance job before production use; do not claim automatic seven-day deletion until it is scheduled. Public display is limited to active sessions even while historical rows remain private.

For local app configuration, copy `app/.env.example` to `app/.env.local` and set the same Supabase project URL and public anon key used by the website. Never put a service-role key in an app. Set `EXPO_PUBLIC_SITE_URL` to the matching website environment. A physical phone needs a reachable host rather than your computer's `localhost`.

Run `npm ci` in `app/`, then create a new development build with `npm run ios` or `npm run android`. Expo Go is insufficient for this background-location/BLE configuration. Existing native binaries need rebuilding for the new location/task/SQLite modules and platform permissions.

## Verification

Automated checks:

```sh
npm run test:race          # scoring, website domain/access tests and PostgreSQL migration tests
npm run test:tracking      # real SQLite persistence, transaction failure and acknowledgement tests
npm run build:race
npm run test --workspace veetr.org
cd app
npm test -- --runInBand
npx tsc --noEmit
npx expo export --platform ios
npx expo export --platform android
```

Before production approval, run a physical iPhone and Android field test:

- Sign in, select a registered boat, consent, and verify its marker on a second device.
- Walk/sail with the screen locked for at least 30 minutes; check GPS timestamps, upload cadence and battery consumption.
- Disable mobile data, keep moving, re-enable it and verify backfill without duplicate points or marker rewind.
- Stop while offline; verify capture stops locally, the map reports stale data, and the marker disappears after reconnecting.
- Reopen after termination; exercise denied/approximate/revoked permissions and expired auth.
- Attempt tracking from a second phone, revoke boat editor access, and unpublish the heat.
- Confirm all sample dates/coordinates and trail points stay tied to the correct boat/session.

Automated builds do not establish battery life, store-review approval, or reliable background behaviour on real devices.

## Standalone offline iPhone test

The Track tab also offers **Record locally** without Supabase configuration, sign-in, or connectivity. Grant background location, start recording, lock the screen, and walk outside. Reopen to inspect the saved-position count and latest-fix age. Stop and use **Export recording** to save JSON through the iOS share sheet. Export does not delete the original; explicitly delete it before beginning another session. Local recordings are never automatically uploaded, including after sign-in or reconnect. One recording is retained at a time, with a 12-hour limit. Map tiles are not available offline.

For TestFlight use `eas build --platform ios --profile testflight`, then submit the completed build with `eas submit --platform ios --id BUILD_ID`. The `testflight` profile is a standalone store build with an incrementing build number; it does not need Metro or a Mac to run. Apple signing credentials and App Store Connect access are required. Submission makes it available for TestFlight processing, not a public App Store release. Add the tester in App Store Connect after processing. External testers may require beta review.

## Unified phone navigation and instruments

The Data board and native Map share a navigation feed. Grant foreground location to see phone SOG (converted from m/s to knots), course over ground, position and accuracy without a device or recording session. Values older than 15 seconds become unavailable, not zero. This foreground display does not save or upload a track.

Start a local recording in Track to persist phone fixes and draw a recent trail (120 points), including after app restart. Map follows new positions until panned; Recenter restores follow. Stops retain the local trail until explicit deletion. Data and Map link to the same recording controls. The full local export remains available in Track; map tiles are not downloaded for offline use.

Fresh connected Veetr telemetry enables the existing wind/heel/heading/start-line board. Valid device GPS takes priority for live display when no phone recording is active; an active phone recording keeps its phone GPS source on both map and SOG board. If device telemetry ages beyond 15 seconds or disconnects, the board falls back to phone mode. COG is never labelled compass heading. Uploads and local recordings in this milestone still capture phone GPS, not Veetr telemetry.

Local recording now accepts foreground-only permission (including iOS Allow Once), explicitly labelled Keep app open. It pauses on backgrounding and resumes when returning with permission. Enable background recording requests the upgrade; Settings is a fallback. Live regatta sharing continues to require background permission.

## Field-test follow-up (build 3)

Map reads the current session's actual saved fixes rather than relying on the recent-point cache, so pre-integration local recordings also show a trail. History includes phone recordings and SOG versus observation time, with breaks across missing readings. Starting a new local recording archives the stopped recording in SQLite; it remains available in History for export or deletion. This does not recover positions that were never recorded.

Track now distinguishes native background startup, background callback timestamps, stop reasons, and persistent background task errors. Resume reapplies native location options instead of treating registration as proof that the location manager is running. Native location callbacks are delivered without the optional deferred interval; SQLite still thins saved fixes to five seconds. Background task errors are preserved for troubleshooting.

The reported screen-lock failure with Always permission is not yet reproduced on a physical device. For validation: start a new recording, verify Screen-lock recording ready and increasing saved positions, lock the phone and walk for 10 minutes without force-quitting, then reopen. Confirm fixes span the locked interval, the map trail and History chart have no unexpected gap, and inspect the last background callback/error. Export the recording if it fails. Automated callback tests establish JS behaviour, not iOS scheduling or file availability while locked.

## Automatic TestFlight delivery

`app/.eas/workflows/testflight.yml` runs mobile type checking and Jest, then builds iOS with the `testflight` profile and submits that exact build to App Store Connect. Failed tests prevent building; failed builds prevent submission. Push triggers cover `main` and `codex/mobile-tracking`, restricted to `app/**` except Markdown-only changes. The workflow can also be run manually from Expo or with `eas workflow:run .eas/workflows/testflight.yml` from `app/`.

The Expo GitHub integration must be installed for `veetrlabs/veetr`, connected to this Expo project, and configured with app base directory `app`. Workflow YAML validation passed. The GitHub app is installed, but connecting the organization repository requires transferring the Expo project to the Veetr Labs organization and completing the project connection. Push delivery is not yet active.

This workflow uses the saved EAS signing/submission credentials. It distributes TestFlight builds, not public App Store releases. It does not publish OTA updates; those require a separate runtime/update-channel rollout and a compatible native build. Existing test builds remain usable while the next build is processed by Apple.

## Public regatta browsing and replay

Track includes a public directory with All, Live, Upcoming and Past filters. It uses published heat dates; draft events stay private. Guests can open a fleet map without authentication. The native map and browser Leaflet map display public boat positions and recent trails; live positions refresh every five seconds while the app is active. Replay controls step through public timestamps, with playback advancing 20 seconds per response. Missing and stale fixes are not interpolated.

Joining/sharing still requires sign-in, boat owner/editor permission and entry in a published heat. New mobile sharing explicitly consents to public live viewing and subsequent replay. The separate `start_replay_tracking_session` RPC records that consent; old live-only sessions retain their original privacy. Replay and directory bounds recheck publication and boat-editor permission. Private phone recordings never enter these APIs.

Production/TestFlight build profiles contain the same public Supabase URL and anon key as veetr.org. These are client identifiers, not service-role credentials; database permissions remain enforced. Local Expo previews use ignored `app/.env.local`.

Deployment must go through `.github/workflows/supabase-production.yml`: merge the reviewed migrations to main, let Actions run the racing/database tests, preview pending migrations, then apply them to the Veetr Regatta project. Do not apply these files manually in the dashboard. Both `202609130001_boat_tracking.sql` and `202609150001_regatta_spectators.sql` are pending on production as of this change. Before they land the app can use the older public directory, but live tracking/replay are unavailable. No production SQL was changed during implementation.
