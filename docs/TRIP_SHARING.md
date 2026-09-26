# Trip sharing (local implementation, not released)

No Expo build or production deployment is needed for development. Do not push app changes to main without explicit release approval: the EAS workflow is triggered automatically.

## Flow

Start trip → select an existing boat from your own/crew boats or create a boat → record privately. Recording without an account or boat remains possible. A signed-in, verified Veetr account and boat membership are required to publish.

The last selected boat is remembered per account. A saved local trip can be assigned a boat before its first upload. Once uploaded, its boat is fixed. The recorder controls sharing independently of boat ownership or other crew members. Finished race recordings can be published as a separate personal copy; official race history is unchanged.

Share live or publish a finished trip as **Anyone with the link** or **Public**. Public trips appear at `/trips/`. Links use a random UUID in the URL fragment so the token is not included in referrers. No owner email/user ID or other boat crew data appears in the public API.

Stopping sharing rotates the token, so the previous URL cannot be reused. Ending a recording preserves its visibility and URL; the link shows the finished trip after the final positions sync. Offline privacy changes are persisted and shown as pending until the server confirms them. Pending requests retry on reconnection/app foreground. Live links expire with the recording session if the app cannot contact the server. Already downloaded data cannot be recalled.

## Storage and permissions

`tracking_sessions` supports a null `series_id` for personal trips. The race-only unique reporter index excludes these sessions, so a personal upload cannot displace a race reporter. `tracking_points` is reused, with nullable instrument samples. `trip_shares` stores the title, visibility and revocable token. All raw tables remain inaccessible to client roles; narrowly granted public invoker RPCs call private-schema functions that check active accounts, verified emails and recorder ownership. Boat membership is checked when creating the trip; an ex-crew member can still revoke their own previously shared trip.

The recorder persists publication state and upload progress alongside the existing SQLite trip. Batch sequence numbers are stable, duplicate-safe and uploaded in order. A finished trip is uploaded privately before its link becomes available. The public viewer reads paginated points, polls every 15 seconds, marks delayed positions, and clears route data when a link becomes unavailable.

Positions use UTC timestamps, speed in m/s and course in degrees. Device instruments store AWS/TWS in knots, AWA/TWA in signed degrees (-180 to 180, port negative), and magnetic heading in degrees. Missing samples remain null, including when display widgets use a zero fallback. Fresh device instruments can accompany phone GPS; samples more than 15 seconds old are not reused. Existing recordings cannot recover instruments that were never recorded.

## Local verification

- DB access/visibility/expiry tests: `node --test supabase/tests/trip-sharing.test.mjs`
- Phone tests: `npm test --prefix app -- --runInBand`
- SQLite persistence: `npm run test:tracking`
- Phone typecheck: `npm run typecheck --prefix app`
- Site build: `npm run build -w @veetr/site`

Set `EXPO_PUBLIC_SITE_URL` to the local site's reachable URL for local share links. Production defaults to `https://veetr.org`. Supabase app/site environment variables must point at the same local backend for end-to-end previews. Physical background GPS/Bluetooth behavior still needs testing on a device using an existing compatible development build, without consuming an Expo cloud build.
