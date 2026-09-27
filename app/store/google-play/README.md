# Google Play closed-test submission

Prepared 2026-09-27. Closed testing is not yet submitted for review.

## Saved in Play Console

- Worldwide Alpha availability and the existing seven-person internal tester list.
- Privacy policy: https://veetr.org/legal/privacy/
- Account and individual data deletion: https://veetr.org/legal/delete-account/
- Data safety, no advertising ID, and no health features declarations.
- Store listing text (draft).

Android version code 20 was built locally and uploaded to the internal track.
Its final bundle no longer contains ACTIVITY_RECOGNITION. A subsequent local
build, version code 21, includes the explicit background-location disclosure.
Check build/submission status before selecting the release; starting a build
is not confirmation that it is available in Play.

## Remaining review material

Google requires actual demonstration videos for both background location and
FOREGROUND_SERVICE_LOCATION. The location form cannot be saved without a URL.
Use an unlisted YouTube video, with no private account details or real participant
positions. Do not use a marketing animation as evidence of app behavior.

Capture on a fresh Android test installation (do not clear a user's recorded trips):

1. Open Track and start private recording.
2. Show the in-app “Location for recording” disclosure; choose Continue.
3. Show Android's precise location and Allow all the time permission flow.
4. Show active recording and its Android notification, then switch to the home
   screen and return to Veetr. Show how the user stops recording.
5. For the location-sharing service declaration, separately demonstrate starting
   and stopping sharing with a dedicated demo race/boat, not real sailor data.

The background-location walkthrough should be about 30 seconds where practical.
Keep disclosure text readable. Capture at least two real Android screenshots for
the listing (for example Data and a recorded trip map). Google requests PNG/JPEG,
320–3840 pixels per side and 9:16 or 16:9 for phone screenshots.

After the video links and screenshots are ready, finish the permission forms,
complete the listing, create the Alpha release from the corrected bundle, then
send the changes from Publishing overview for review. Twelve continuously opted-in
testers are needed for the qualifying testing period, not to prepare the release.

## Prepared assets

- `icon.png`: existing 512×512 Veetr application artwork, copied from the site.
- `feature-graphic.png`: 1024×500 promotional graphic, generated with the built-in
  image tool and exported at Google's required size. It is not an app screenshot.

Generation prompt: “Create a Google Play feature graphic for Veetr sailing app.
Use the supplied image as the exact existing app icon supporting insert, preserve
its sailboat identity and blue colors. Wide banner intended for 1024 by 500 pixels;
generous safe margins. Dark navy background, subtle turquoise curved sailing route
accent. Existing blue sailboat icon on right, crisp white large typography left
reading exactly 'Veetr', and below exactly 'Sailing instruments' then
'GPS trips • Live race sharing'. Clean restrained marine software aesthetic.
No phones, no fabricated UI, no claims of safety or tracking reliability, no awards,
prices, badges, extra words or watermark. This is a promotional feature graphic,
not a screenshot.”

## Background location form copy

App purpose:

Veetr provides sailing instruments, private GPS trip recording and optional live
race location sharing. Sailors can record and review their route, speed and course,
view race participants on a map, and connect compatible Veetr instruments.

Location access:

GPS trip recording: the sailor starts a recording in Track. Background location
keeps recording route, speed and course while the screen is locked or another app
is open. A foreground-service notification indicates recording on Android. The
sailor can stop recording in Veetr. Trips remain on the phone unless the sailor
explicitly chooses to upload or share them.
