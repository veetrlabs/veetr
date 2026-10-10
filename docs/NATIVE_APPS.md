---
title: Native apps
description: How the Veetr iPhone and Android apps connect to instruments, record trips, and support racing.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/NATIVE_APPS.md
---

The Veetr native apps bring sailing instruments, trip recording, and race courses to **iPhone and Android**. Record with phone GPS on its own, or connect Veetr Vane over Bluetooth for wind and instrument data.

The apps are currently available through invitation-only beta testing. See **[screenshots and installation instructions](/docs/mobile-apps/)** to request access.

## The five tabs

| Tab | What it does |
| --- | --- |
| **Data** | Shows sailing instruments, including speed, wind, heading, heel, and distance to a configured start line. Readings depend on the available GPS and instrument data. |
| **Map** | Shows your position and track, map styles and nautical seamarks, and the course for a joined race. |
| **Track** | Starts a private GPS recording and lists saved trips. Open a trip to review its route and recorded readings. |
| **Races** | Opens boat invitations and lets you choose a race in the series and get ready to race. |
| **Settings** | Contains account, Bluetooth, calibration, location, display preferences, start-line setup, and anchor monitoring. |

## Phone GPS and Veetr Vane

Phone GPS supplies positions for recording without additional hardware. Allow location access when requested; recording with the screen locked also depends on background-location permission and the phone's power settings.

Connect Veetr Vane from Bluetooth settings to add its sensor readings. Bluetooth connects directly to the unit; it does not require the browser's Web Bluetooth support. Wind and other instrument values remain unavailable when their data source is missing.

## Record and review trips

Start recording in **Track**, then stop when your trip is finished. Saved trips include the route and recorded readings; wind charts require wind data to have been recorded during the trip.

Private recordings stay on the phone unless you choose to share them. Live sharing and shared trip links use online services and require an account. Follow the **[recording and sharing guide](/docs/share-your-trip/)** for visibility choices, uploads, and sharing a completed trip.

## Join a race

Open the invitation for your boat, pair the phone with the series, choose a race, and press **Ready to race**. Pairing through an invitation does not require an account.

The joined race's published course appears on the map, including start-line ends and numbered turning marks. Race recordings keep a course snapshot for later trip review; older recordings without a saved course do not gain one automatically.

See the **[racer's guide](/docs/race-skippers/)** for participation and the **[referee's guide](/docs/race-referees/)** for preparing and managing courses on the website.

## Start-line and anchor tools

In **Settings**, open start-line setup and capture the port and starboard ends with phone GPS. Either end can be captured first. This is the line stored on the phone; it does not change the referee's published course.

The anchor monitor lets you set an anchor position, chain length, and extra margin, then start monitoring. Review location and notification permissions and use the alarm-sound test before relying on alerts. The phone needs to remain powered and able to obtain location updates.

See the **[start-line and anchor screenshots](/docs/mobile-apps/#start-line-and-anchor-tools)** for these controls.

## Local and online features

The Bluetooth instrument connection and local recording do not need a continuous internet connection. Unloaded map areas, race updates, invitations, and sharing need internet access. If an upload is pending, reconnect and open Veetr to let it finish before removing the local recording.

Native-app recordings and the web dashboard's browser history are separate stores. Installing the app does not import the browser's history.

## Source and development

The native app lives in [`app/`](https://github.com/veetrlabs/veetr/tree/main/app) and uses React Native and Expo. The browser dashboard lives in [`pwa/`](https://github.com/veetrlabs/veetr/tree/main/pwa).

See the [mobile development README](https://github.com/veetrlabs/veetr/blob/main/app/README.md) for setup and simulator workflows. Test Bluetooth, GPS, and background recording on a physical phone; a simulator cannot validate those device behaviors.
