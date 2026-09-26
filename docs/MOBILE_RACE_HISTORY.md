# Mobile race history and replay

Race, live and private recording share the existing location pipeline. Every accepted fix is written to `recording_history` in the same SQLite transaction as the upload outbox. Acknowledgement only removes outbox rows.

`recording_sessions` preserves session metadata after remote recording completes. Track lists both private and race recordings; race trips retain their series/event IDs, boat and race name. Existing private archives remain readable. An active session from an older build is backfilled. Previously completed races whose metadata was already discarded cannot automatically be reconstructed as named local trips.

Trip detail provides the saved own track offline, export, and a link to race replay. Deleting an archived personal copy deletes local history only; it never calls the server to delete official race data. Current sessions cannot be deleted through the archive API.

The `/race-replay` screen is shared by Track and Races. Track initially shows only the local boat, with competitors loaded on request. Races opens the server fleet replay. Competitors use the existing public `public_replay_tracks` RPC and its access rules; the app does not broaden access. The parser, chunk cache and seek-request coordinator are shared with the website. Native rendering uses the existing map implementation. Timeline playback, heat selection and per-boat visibility work without a new native dependency.

Competitor history is held in memory only while the view is active. It is cleared on hiding competitors or leaving the view. Network/access failures clear the displayed remote data and expose a retry; own saved points remain usable. Gaps longer than 60 seconds and distinct phone sessions are separate trail segments. Replay shows actual recorded fixes rather than inventing positions across missing GPS periods.

## Validation before release

- Mobile Jest suite and TypeScript checking.
- Real SQLite tests: upload acknowledgement, completion/restart, legacy backfill, archive deletion and active-session protection.
- Shared replay-cache tests: chunk boundaries, paging, session boundaries and GPS gaps.
- On Android and iOS, record a race, stop, complete upload, restart, open Track and replay offline. Enable competitors online, select heats, scrub and hide boats. Check small screens and landscape, export, and deletion.

This change does not start an EAS build. Bundle it with tracking recovery and optional diagnostics for the next explicitly requested release. Diagnostics still require their separate database migration and store/privacy release checks described in MOBILE_DIAGNOSTICS.md.
