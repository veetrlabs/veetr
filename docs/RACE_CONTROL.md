# Veetr Race Control

An incremental monorepo addition for informal mixed-fleet regattas. The existing BLE dashboard remains in `app/`; firmware and device operation have no new cloud dependency. Phone-based participant tracking is described in [Mobile tracking](MOBILE_TRACKING.md).

## Run locally

Use Node 22.19+ (the existing website workspace also requires it), npm and, for cloud development, Docker and the Supabase CLI.

```sh
npm ci
npm run dev --workspace veetr.org
```

Open http://localhost:4321/races/manage/. Management requires sign-in; configure Supabase below before using the committee workspace. Without backend configuration the app shows a setup message, never anonymous editing forms. Create series, edit its fleet, create races and register boats under **Series & races**. New races initially register the entire series fleet. Boats are selected from the shared registry while retaining their UUID. Category is a series assignment, not a permanent property of a boat.

For Supabase:

```sh
supabase start
cp veetr.org/.env.example veetr.org/.env.local
# Put the local anon key from `supabase status` into .env.local.
npm run dev --workspace veetr.org
```

The dedicated local ports are API **54421**, database **54422**, Studio **54423**, and email inbox **54424**, to avoid another project's default ports. Auth redirect URLs for development (5175) and preview (4175), on both `localhost` and `127.0.0.1`, are in `supabase/config.toml`. After changing these URLs, run `supabase stop --project-id veetr` and `supabase start` to apply them, then request a fresh sign-in email. The frontend receives only the public anon key, never a service-role key.

Use **Sign in** in the top-right header. Enter your email and follow the link; the first sign-in also creates your account. In local development, open the inbox linked from the account panel at http://127.0.0.1:54424. The seed account is `official@example.test`; its password `local-race-control-only` is solely for the automated local integration test. Never load this fictional account into production. The seed creates a published 13-boat, five-race fixture. M1 has 2, 8, 12, 13, 9 points: raw 44; discard 13; counted 31.

Public fixture: http://localhost:5175/?public=298ec7a6-e68f-59ea-8bd0-54e5b6e56d2d

Existing local-only drafts from the earlier preview are preserved and become visible after sign-in. They stay local until **Attach and sync this series** is selected in **Account & team** (also available as an attachment control below the race workspace). Cloud series sync after edits, every two seconds, on reconnect and on demand. A series creator is its admin and retains access as owner.

Open **Account & team** in the header to see your signed-in email, sign out, and manage the selected series. Admins see the owner and current officials, and can add a registered teammate by email, change their role, or remove their access. Teammates must first sign in once; saving team access does not send an invitation email. Race officials manage racing; only admins can manage access. Team email addresses are exposed only to that series' admins by the database. Boat identity changes require the boat owner on the server.

## Finish-line workflow

Choose the active race. The finish-line view shows all registered boats together, with category labels; tap each boat as it finishes. The log shows overall arrival order, while scoring positions are assigned within each category. Standings default to all boats, scoring overall finish order and fleet-wide penalties. Selecting a category uses category finish places and category entry counts. Both views apply the same weights, discards and tie rules without changing recorded results. Non-finish statuses are under the status disclosure. Recorded results support status editing, moving a boat upward, clearing an individual result with an inline confirmation, and undoing the last recorded result across categories. Timestamps are metadata, never a source of corrected times. Changing a result back to FINISHED records a new timestamp.

Race and fleet editing remain available after sharing. New races share live results by default; **Share live results** controls whether a race appears publicly. Existing private drafts stay private until sharing is enabled. Incomplete results are supported, and standings remain provisional while racing continues. Category changes recalculate category positions from the recorded finish order. Officials can correct results without unpublishing them. Legacy `locked` records remain readable, public and editable; the UI no longer offers locking or reopening. Resetting all results still requires confirmation.


The officials' standings include draft races and are labelled provisional. The signed-out home page lists published series, with search by name/year. The header keeps sign-in available without a second officials panel. The committee workspace has a **Public results** link; individual results pages have **All series** navigation. Sync controls appear only in the signed-in workspace when account changes are pending; an offline indicator remains visible to officials during connection loss. The results table lists each boat once, by name, without sail numbers. Names link directly to boat profiles; additional boat details are shown on those pages. Discarded scores are red with a strikethrough. Both the directory and series pages require no login and refresh every two seconds; draft-only series and draft-only entrants are excluded.

The top-level **Boats** directory is public. Every registered boat has a stable UUID and its own profile (`?boat=UUID`) containing basic boat details and results from all shared series. Private races and account/contact details are excluded. Signed-in users can create boats independently of a series. On a boat profile, **Edit boat** is available to its owner and admins of a series containing that boat. Edits update the shared identity and associated series snapshots, with revision checks, stale-edit protection and audit records. Race officials and public visitors cannot edit boat identities.

**Fleet** selects existing registered boats for the current series and assigns their series-specific categories. **Create a new boat** also creates a registry entry and selects it for that series. New selections are automatically entered into races that have no results yet; for races already underway, select entries under **Series & races**. Removing a boat with results is blocked until those results are cleared. Creating and browsing registry boats requires a server connection; already-selected boats and finish recording remain available offline. Canonical identity is held in `boats`; series snapshots cannot overwrite an existing registered identity.


## Scoring assumptions — confirm with the committee

`packages/scoring` is pure TypeScript, independent of React and Supabase. It exposes `calculateRacePoints`, `calculateRaceResults`, `calculateDiscards`, and `calculateSeriesStandings`.

- Categories are independent. Lower points win. There is no handicap or corrected time.
- **Long-race assumption:** `points = base points × race weight`. This is deliberately provisional; no negative spreadsheet workaround is retained. Change `Policy.weightPoints` after the historical rule is verified. Race weight is persisted explicitly.
- FINISHED earns finishing position. DNS, DNF, DSQ, RET and OCS each default to **number of registered boats in that race's category + 1**, then apply the weight. `Policy.penalties` can instead supply a fixed value for each status.
- A recorded result in any of the six statuses counts as eligible by default, including penalties. Missing results and non-entries do not count and are displayed as a dash; there is no silently invented DNS. This interpretation of “completed eligible races” needs committee confirmation. `eligibleStatuses` can narrow it.
- App discards default to none. Series and events each store threshold rules `{from, discard}`. Event thresholds count heats with results for all entries; series thresholds count events marked completed. The scoring package retains its legacy default for compatibility, but app calculations pass an explicit discard count. Discard the highest weighted eligible scores. Equal worst scores discard the later race, then use ID order. `discardEvery` is configurable. All default statuses are discardable; this is not a full Racing Rules of Sailing implementation.
- Ties compare counted totals, then counted scores sorted best to worst (countback), then the latest race backward, **including discarded results** in that final comparison. A missing race is worse in this comparison. Remaining exact ties share rank (1, 1, 3); stable ID order is display-only. `tieBreak: 'shared'` bypasses secondary comparisons.
- Boats with no recorded result are unranked. Missing draft results can otherwise make provisional totals look favorable. Shared races may be incomplete; participation across the series can vary.

The signed-in Race Control home shows a series table with New and Edit actions, text filtering and sorting. Opening a series shows its races, and opening a race shows its heats. Breadcrumbs and URL parameters preserve this hierarchy through reloads and browser history. Series Edit configures series details, categories and event discards; race Edit configures heat discards; heat Edit configures date, sharing, race assignment and registration. Opening a heat leads to finish recording. Event standings sum heat points after event discards; series standings use event rank multiplied by event weight, then series discards. The public standings and boat profiles allow switching between the series and individual events and display applied thresholds. Existing races are interpreted as one-heat events, preserving IDs and results; saving event settings materializes that structure. Existing race weight becomes event weight. No discards apply until configured. Finish recording still selects individual heats, labelled with their event.


## Offline and conflicts

The production PWA precaches the app shell and hashed assets with Workbox. Use HTTPS or localhost. Installation has PNG icons and a standalone manifest. Service-worker updates wait for an explicit **Apply update** between races. Initial sign-in must be online. A restored sign-in session allows cached work during temporary network loss; signing out or losing the restorable session returns to the sign-in screen. First load must be online; Vite development mode does not install the production service worker.

```sh
npm run build:race
npm run preview -w @veetr/race-control
```

IndexedDB keeps each series document, server revision, pending flag, mutation UUID, account scope and save time in one transaction. The pending document is a coalesced outbox of all unsynced changes, not a per-tap event log. Local edits never wait for cloud requests. A save indicator appears only after the IndexedDB transaction commits. Storage failures are visible. Another tab's stale local write is rejected transactionally. Use one primary device and tab per series.

Cloud writes use a PostgreSQL RPC transaction with a row/advisory lock, expected revision and idempotency key. Successful retries do not duplicate results. Edits made during an upload remain pending; acknowledging the earlier upload advances their base revision. A stale server revision raises `SYNC_CONFLICT`; no automatic last-write-wins merge occurs. The local pending document remains available. Export it before choosing **Resolve conflict: reload cloud**, then reconcile the backup manually. Backups can be restored as a new draft series without replacing the original. Restored boat identities are retained; categories/races receive new IDs. An uncertain acknowledgement followed by more edits may conservatively require this same conflict workflow.

Browser storage can be evicted or cleared, so keep exported backups at race breaks. No promise of permanent storage is made. Public pages do not persist standings offline; the committee's cached series is the offline source of truth on its device. Account-owned local records are hidden when signed out, but IndexedDB is not encrypted: use trusted committee devices. Role revocation is enforced when syncing; an offline client may retain previously downloaded data.

## Data and authorization

The SQL migration creates `series`, `race_officials`, reusable `boats`, `boat_members`, `race_categories`, `series_entries`, `races`, `race_entries`, `race_results`, and `series_changes`. UUIDs, foreign keys, category-scoped finish uniqueness, valid statuses, positive weights, audit actors and timestamps are enforced in PostgreSQL. Auth users live in `auth.users`; no redundant public user table is needed.

`series.document` is the atomic offline exchange envelope. `save_series` updates it and the normalized relational projections in a single transaction; clients must not update either side separately. Boat, category and race identities persist across saves; entry/result projections are rebuilt for the small fleet. Audit snapshots retain every successful cloud save and actor, not every unsynced tap. History retention and an audit browser are future work.

RLS permits official reads of their series and denies access to other series. Authenticated users receive no direct DML grants. The narrowly granted, fixed-search-path security-definer RPC rechecks authorization, revision and input constraints. Anonymous users can only execute the published directory and results projections. `set_race_official` requires a series admin and cannot change the series creator. Boat memberships are reserved for a future owner/crew workflow; the current boat owner is the immutable `boats.owner_id`.

Supabase access is concentrated in `src/api.ts`; generated `database.types.ts` types the client. Auth UI uses the same client. Regenerate after migrations with `supabase gen types typescript --local > veetr.org/src/features/racing/database.types.ts`. See Supabase's [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database function guidance](https://supabase.com/docs/guides/database/functions).

There is no separate API server or Edge Function: PostgreSQL handles the transactional invariant. This MVP uses bounded polling, not Realtime subscriptions. Multiple-device collaboration would require finer-grained result operations and an explicit merge UX rather than weakening revision checks.

## Future competitor app

Add `apps/mobile` when that phase begins. Preserve the existing device/BLE dashboard's cloud independence. A future `NavigationSource` interface can emit common timestamped navigation samples from `PhoneNavigationSource` or `VeetrNavigationSource`; BLE acquisition remains local. Shared navigation samples can build on `packages/shared` without coupling scoring to telemetry.

Future `devices`, `device_pairings`, `tracking_sessions` and `track_points` should reference stable boat/user/race UUIDs. Tracking must be opt-in, with session-level consent, access and retention rules. Do not put private locations into public standings documents. High-volume track points need separate ingestion/batching and retention; they must not pass through the series snapshot RPC. GPS finish detection is future assistance, not implemented officiating behavior.

## Validation

To check the browser magic-link flow, open the app at `http://127.0.0.1:4175`, request a link for `official@example.test`, open the newest message in `http://127.0.0.1:54424` (mailbox `official`), and click **Log In**. Confirm that it returns to the same app origin, **Account & team** shows the demo account and its series-owner access, and login survives a reload. This flow was verified locally; the automated integration test below uses password sign-in and does not cover email redirects.

```sh
npm run test:race                 # scoring, IndexedDB/domain, embedded PostgreSQL RLS tests
npm run build:race                # strict TypeScript + production PWA
npm run test:race:integration     # requires local Supabase + seed + .env.local
npm run format:race
```

CI runs the first two commands. The embedded PostgreSQL test stubs only Supabase's `auth.uid` and users/roles, then executes the real migration and tests RLS, grants, publication, admin locks, invalid result rollback, and idempotent/conflicting saves. The integration test additionally uses real Supabase Auth/PostgREST and the published M1 fixture; it creates a clearly named draft test series in the local database.

The source now lives in `veetr.org/src/features/racing`; imported season documents are in `veetr.org/imports`. The shared website header links to public races and boats; `/races/manage/` is the authenticated workspace and `/account/` is the sign-in callback. Both use the same Supabase client and browser storage on the website origin. The old standalone preview uses separate origin storage: sync pending edits or export local-only drafts before switching.

Before deployment, apply Supabase migrations without the development seed. Set Supabase Site URL and allowed redirect URL to `https://veetr.org/account/`. Configure repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the production project URL and public key. Never use a service-role key. The existing mirror-site workflow builds `veetr.org/dist` and publishes the whole website through the existing generated-site repository. Static route directories are generated, so no SPA fallback is needed. The build fails before publication if backend variables are absent. Local Auth configuration includes 4321 and 4322 callbacks; restart local Supabase after changing its configuration. Do not run the development seed in production. No hosted deployment is performed by this change.

## Dynamic content and future rendering

Astro builds generic application shells. React loads series, races, boats, and live results from Supabase at runtime. Creating or editing entities requires no Git change or rebuild. Current query URLs remain supported. Slugs are assigned automatically in Supabase for series and boats, with numeric suffixes for duplicate names, and remain stable on renaming. Public URLs use `/races/?series=orlicka-serie-2026` and `/boats/?boat=luna`. Legacy UUID links are resolved and replaced in browser history with the canonical slug URL. The public routing lookup exposes only entities already visible through the public directory RPCs. Path-style URLs are deferred until hosting supports request routing. There is no build-time database fetch or per-entity URL registry.

Per-entity server-rendered HTML is deferred. These can be added later while retaining the existing data and scoring logic; dynamic Astro rendering will require a compatible hosting runtime.
