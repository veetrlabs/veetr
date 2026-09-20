# Race phone invitations and morning readiness

The existing Track tab and trip map previews are unchanged. Race phones live in Regattas.

## Referee

In a series' Fleet (or boat invitation panel), open **Race phones · no account needed**. Select the race and save its expected start in your local time. Select a boat and create its private phone link. Copy/share it using WhatsApp or email. A link connects one phone; replacing or revoking it withdraws that phone's access. Account/profile editing and scoring rights are never granted.

Publish the appropriate heat and enter each boat before live sharing. Sailors may get ready before publication; their status explains what is missing. At the start, press **Start live tracking for ready phones**. This opens tracking for this race, independently of scoring publication and the old series tracking window. **Pause live tracking** between heats; **Finish race tracking** ends readiness for all its phones and preserves the shared replay. A phone with no recent check-in is shown as not recently reachable. A check-in alone does not prove GPS reception.

## Sailor

Open the invitation, install Veetr if needed, then tap the invitation again. The native screen shows the boat, race, expected start and **Ready to race**. This explicit consent enables background GPS now and authorizes public location/replay only during referee-opened windows. No account is required. Background GPS consumes battery even while waiting. Keep internet available and do not force-close the app.

Readiness opens 12 hours before the expected start and expires 18 hours after it, or when the referee finishes/revokes access or the sailor stops. The schedule is informational: changing 11:00 to 11:30 doesn't publish location automatically. The referee explicitly starts sharing. The app checks race state using background location callbacks and its foreground timer; this is not a synchronized remote wake-up. A force-closed app cannot be started remotely. If race control hasn't been reached for 60 seconds, new capture for this race stops until connectivity returns. Already queued points are retried; the server only accepts points inside the actual live intervals, ready session and expiry/end boundary. There may be gaps under poor connectivity.

Account users can open **Regattas → Share boat location**, then a ready-race card for their connected boat. Legacy connected boats stay visible with closed/unpublished reasons. Guest phone credentials remain separate from account sign-in and are not included in trip exports.

## Link and release configuration

- Public landing page: `https://veetr.org/join/<private-token>/`. It does not consume the invitation; pairing occurs after the sailor presses Ready to race. No analytics, `no-referrer` and no search indexing on this page.
- Installed-app route: `/join/[token]`, with a `veetr://join/<token>` fallback button.
- iOS associated domain: `applinks:veetr.org`; AASA uses the existing native signing team `3Z496JB962` and bundle `com.veetr.mobile`. Verify it against the release signing identity before field rollout.
- Android verified links: `veetr.org/join/*`, package `com.veetr.app`. Set website build variable `PUBLIC_ANDROID_APP_LINK_FINGERPRINTS` to the Google Play **app-signing** SHA-256 fingerprint(s), comma separated. The upload-key fingerprint is not interchangeable. Without this value, the website still opens and its custom-scheme button works, but Android automatic verified opening is not configured.
- Set `PUBLIC_IOS_INSTALL_URL` to the public TestFlight invitation during testing (later the App Store URL). Set `PUBLIC_ANDROID_INSTALL_URL` to the tester opt-in/download URL (later the Play Store URL). Missing URLs show an honest instruction to obtain the tester invitation from the referee; no dead store links are invented.
- Website rewrites serve the same landing shell for all private links. Do not add these invitations to the service-worker navigation cache.
- Deploy migration `202609200001_race_phone_pairing.sql`, then the website, then rebuild/install the native apps to apply associated domains/intent filters. Native JavaScript changes alone do not configure universal links.

## Verification

Database tests cover anonymous capabilities, no direct table access, single-phone binding and retry, account entry visibility, no pre-start or paused publication, replay, revocation, and finishing all phones. Mobile service tests cover activation, pause, stale race-control contact and native GPS shutdown on revocation. Before declaring outdoor readiness, test signed iPhone and Android builds with a real invitation, screen locked, referee start/pause/finish, lost connectivity, and return after force-close. Simulator tests cannot establish real-device background reliability.
