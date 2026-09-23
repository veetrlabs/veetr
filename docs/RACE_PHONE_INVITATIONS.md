# Race phone invitations and morning readiness

The existing Track tab and trip map previews are unchanged. Race phones live in Regattas.

## Referee

In a series' Fleet (or boat invitation panel), open **Race phones · no account needed**. Select the race and save its expected start in your local time. Select a boat and create its private phone link. Copy/share it using WhatsApp or email. A link connects one phone; replacing or revoking it withdraws that phone's access. Account/profile editing and scoring rights are never granted.

Publish the appropriate heat and enter each boat before live sharing. Sailors may get ready before publication; their status explains what is missing. At the start, press **Start live tracking for ready phones**. This opens tracking for this race, independently of scoring publication and the old series tracking window. **Pause live tracking** between heats; **Finish race tracking** ends readiness for all its phones and preserves the shared replay. A phone with no recent check-in is shown as not recently reachable. A check-in alone does not prove GPS reception.

## Sailor

Open the invitation, install Veetr if needed, then tap the invitation again. The native screen shows the boat, race, expected start and **Ready to race**. This explicit consent enables background GPS now and authorizes public location/replay only during referee-opened windows. No account is required. Background GPS consumes battery even while waiting. Keep internet available and do not force-close the app.

Readiness opens 12 hours before the expected start and expires 18 hours after it, or when the referee finishes/revokes access or the sailor stops. The schedule is informational: changing 11:00 to 11:30 doesn't publish location automatically. The referee explicitly starts sharing. The app checks race state using background location callbacks and its foreground timer; this is not a synchronized remote wake-up. A force-closed app cannot be started remotely. If race control hasn't been reached for 60 seconds, new capture for this race stops until connectivity returns. Already queued points are retried; the server only accepts points inside the actual live intervals, ready session and expiry/end boundary. There may be gaps under poor connectivity.

All sailors open **Regattas → My boat · join with invitation**, or tap their referee’s boat invitation directly in WhatsApp/email. The Regattas screen accepts a pasted invitation and returns to the connected boat’s readiness screen. No fleet picker or account sign-in is required. Account settings contain only account controls. The old sharing route remains only for finishing existing legacy sessions. Guest phone credentials remain separate from account sign-in and are not included in trip exports.

## Link and release configuration

- Public landing page: `https://veetr.org/join/<private-token>/`. It does not consume the invitation; pairing occurs after the sailor presses Ready to race. No analytics, `no-referrer` and no search indexing on this page.
- Installed-app route: `/join/[token]`, with a `veetr://join/<token>` fallback button.
- iOS associated domain: `applinks:veetr.org`; AASA uses the existing native signing team `3Z496JB962` and bundle `com.veetr.mobile`. Verify it against the release signing identity before field rollout.
- Android verified links: `veetr.org/join/*`, package `com.veetr.app`. Set website build variable `PUBLIC_ANDROID_APP_LINK_FINGERPRINTS` to the Google Play **app-signing** SHA-256 fingerprint(s), comma separated. The upload-key fingerprint is not interchangeable. Without this value, the website still opens and its custom-scheme button works, but Android automatic verified opening is not configured.
- Set `PUBLIC_IOS_INSTALL_URL` to the public TestFlight invitation during testing (later the App Store URL). Set `PUBLIC_ANDROID_INSTALL_URL` to the tester opt-in/download URL (later the Play Store URL). Missing URLs show an honest instruction to obtain the tester invitation from the referee; no dead store links are invented.
- Website rewrites serve the same landing shell for all private links. Do not add these invitations to the service-worker navigation cache.
- Deploy migration `202609200001_race_phone_pairing.sql`, then the website, then rebuild/install the native apps to apply associated domains/intent filters. Native JavaScript changes alone do not configure universal links.

The Google Play Console **App signing → Digital Asset Links JSON** snippet verified on 2026-09-22 gives this public certificate fingerprint for `com.veetr.app`:

```text
6F:17:22:5C:42:28:6E:44:82:E9:B5:DD:28:FD:0D:F8:CC:7C:3A:12:61:DC:A0:2E:C6:A3:3A:40:26:03:8F:F0
```

Configure it as `PUBLIC_ANDROID_APP_LINK_FINGERPRINTS` in Cloudflare Pages project `veetr-site`, then rebuild the production deployment. Confirm `https://veetr.org/.well-known/assetlinks.json` contains the package and fingerprint above. This fingerprint is public identification, not a private signing key. Recheck Play Console after signing-key upgrades.

## Verification

Database tests cover anonymous capabilities, no direct table access, single-phone binding and retry, account entry visibility, no pre-start or paused publication, replay, revocation, and finishing all phones. Mobile service tests cover activation, pause, stale race-control contact and native GPS shutdown on revocation. Before declaring outdoor readiness, test signed iPhone and Android builds with a real invitation, screen locked, referee start/pause/finish, lost connectivity, and return after force-close. Simulator tests cannot establish real-device background reliability.

## Website heat map and replay

Both race and heat details have a **Map & replay** tab. The race map covers the full race recording; the heat map is restricted to that heat’s start/end interval and entrants. Both use the same controls with one continuous timeline, play/pause and 1–120× playback. It follows the latest positions by default. Scrubbing backward pauses following so spectators can inspect earlier moments while fresh data continues arriving. Moving to the end resumes following; playback also resumes following when it catches up. Metadata and chunk versions refresh every ten seconds even while viewing history. There are no Live, Full recording or heat selector buttons; the detail page determines the scope.

Officials mark **Start heat / End heat** or edit actual timestamps afterward, including for older recordings. These boundaries are stored independently of results in `heat_tracking_intervals`; they do not start/stop phone tracking or change scoring. Phone tracking can continue between heats. A heat without timestamps explains that the referee must set its start time.

`public_race_replay` returns time bounds, published heat choices and positions. Selecting a heat restricts points to its actual interval and entrants. Historical trails cover up to five minutes (at most 60 fixes per boat); boats with no fix for five minutes disappear. Public access requires published/locked heats and entered boats. Revoked invitations and legacy sessions without replay consent are excluded. Finishing race tracking preserves previously shared history.

Guest recordings belong to their race event. Legacy account sessions have no event ID and are restricted to the heat's UTC date. Apply migrations `202609220002_heat_replay.sql` and `202609220003_race_replay_intervals.sql` before deploying the website.

Replay now uses `public_replay_tracks` for authorized raw GPS data. The browser caches five-minute chunks from the race or heat start through the selected replay time in memory, fetching pages of at most 2,000 points. Playback and scrubbing compute frames locally; they do not request animation frames from the server. Trails retain the entire loaded history, with separate lines for different phone sessions. A short look-ahead is loaded before chunk boundaries. Metadata includes content versions so removed access and late uploads invalidate affected chunks. For growing chunks, the server verifies the cached prefix and returns only appended points; a changed prefix triggers a full chunk replacement. Failed metadata refresh clears cached positions.

Interpolation uses nearby fixes from the same phone session and never bridges gaps over 60 seconds. Coordinates between fixes are estimates. The cache is discarded when the map unmounts, with no persistent browser track storage. Apply migration `202609220005_replay_track_chunks.sql` before deploying this client; the older frame RPCs remain compatible for older clients.

The mobile Races and Track tabs show the joined boat's readiness/sharing state with direct map and management actions. The Map tab keeps navigation GPS and start-line tools while adding the joined race's public fleet. Migration `202609230001_race_phone_fleet.sql` resolves the phone invitation to the race without requiring an account; it validates the phone credential and returns only the existing public replay positions. Deploy this migration before the mobile release. The map refreshes while focused and clears remote positions on read failure. Local GPS remains available independently.

Mobile fleet history uses `race_phone_tracks` after migration `202609230002_complete_mobile_fleet.sql`, sharing the website’s five-minute chunk cache and retaining all authorized race tracks. Inactive boats remain at their last reported position; separate phone sessions render as separate lines. The legacy `race_phone_fleet` response now also retains stale boats and full session trails for already-installed clients. The Map tab initially fits the joined fleet instead of following only the phone; GPS follow is still available explicitly.
