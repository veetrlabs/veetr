# Google Play closed-test preparation

Status checked 2026-09-26. Package: `com.veetr.app`.

## Saved in Play Console

- Reviewer sign-in details and instructions.
- No ads, no government affiliation, no financial features.
- Target audience: 13–15, 16–17, and 18+ (confirmed by Jan).
- App category: Sports. Support: veetr@linhart.email. Website: https://veetr.org.
- English short/full store descriptions saved as a draft; visual assets remain missing.
- IARC terms accepted with Jan's explicit approval; content rating saved for review. Generated ratings include PEGI 3 and ESRB Everyone, with Shares Location. Target audience remains 13+.

Dashboard reports 7 of 11 setup tasks complete. Closed testing has not started.
Data safety has a saved partial draft declaring collection and username/password accounts.

## Reviewer access

A dedicated confirmed production Auth account was created for Google review:
`linhartescope+veetr-play-review@gmail.com`.
Its password is stored in the Play Console app-access entry, not this repository.
It has crew membership of **Review Demo Boat** in **Veetr App Review Demo**
(`veetr-app-review-demo-2026`), with boat tracking access verified in the database.
It has no administrator role. The demo has no recorded replay data yet.
Password sign-in has not been independently tested.

## Remaining prerequisites

- Add app icon (512×512), feature graphic (1024×500), and at least two genuine phone screenshots. Listing video is optional.
- Publish the expanded privacy policy for app accounts and race location processing before submitting its URL and final Data safety answers. Audit third-party SDK disclosures before finalizing.
- Publish `/legal/delete-account/`, a dedicated support-email request path, and release the new mobile Account settings link. Requests require ownership verification and manual processing; no automated account deletion has been added. Account settings tests (3), mobile typecheck and website build pass.
- Finish Health declaration after removing the unused ACTIVITY_RECOGNITION permission introduced by expo-sensors. `app/app.json` now blocks it; Expo manifest introspection verifies `tools:node="remove"`. This change requires a new Android binary and has not been built/uploaded yet.
- Check any location/foreground-service declarations required for the release, including demonstration material if requested.
- Configure closed-test countries and tester list, create the closed release, and send the completed setup for review.

Deployment note: the website README refers to `.github/workflows/mirror-site.yml`,
but that file is absent from both the current checkout and fetched `origin/main`.
Confirm the current site publication mechanism before claiming these pages are live.

The Console currently requires at least 12 opted-in closed testers for at least
14 days before applying for production access. Internal-track testers do not
start this closed-test period. No tester invitations were sent during setup.
