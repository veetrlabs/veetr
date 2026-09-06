---
title: Progressive Web App
description: How the installable Veetr dashboard connects, displays, stores, and manages sailing data.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/PWA.md
---

The Veetr Progressive Web App (PWA) is the display and control surface for the hardware. It is a React and TypeScript application hosted at **[app.veetr.org](https://app.veetr.org/)** and can be installed from a compatible browser without an app store.

## What the PWA does

- Connects directly to a Veetr unit with the Web Bluetooth API.
- Shows apparent and true wind, speed, heading, heel, GPS quality, signal strength, and distance to a regatta start line.
- Smooths visual movement without changing the raw values sent by the firmware.
- Stores ten-second averaged readings locally for charts and track history.
- Shows the current position and recorded track on an OpenStreetMap and OpenSeaMap view.
- Sends calibration, device-name, and regatta-line commands to the firmware.
- Checks GitHub releases and performs firmware updates over BLE.
- Provides light and dark themes and responsive layouts for cockpit displays.

## Browser requirements

Veetr needs a browser that exposes the Web Bluetooth API. Chrome, Edge, and other Chromium-based browsers are the normal choice on Android, Windows, macOS, ChromeOS, and Linux where the browser and Bluetooth adapter support it.

Safari and Firefox do not currently provide the required Web Bluetooth connection. On iPhone and iPad, use the Bluefy browser described in the **[user setup guide](https://veetr.org/docs/)**; installation and offline behavior there may differ from a Chromium PWA.

The app must be served over HTTPS, or from `localhost` during development, before a browser will allow Bluetooth access.

## Connection model

When you choose Connect, the browser opens its own Bluetooth device picker. The PWA filters that list for Veetr's service, connects to the GATT server, subscribes to telemetry notifications, and finds the writable command characteristic.

After connecting, it requests the firmware version and saved regatta-line coordinates. Incoming JSON fields are mapped to the dashboard's shared sailing-data model, and the most recent message time is tracked so stale or interrupted connections are visible.

Bluetooth permission belongs to the browser and device. Veetr cannot silently scan for nearby hardware or bypass the browser's pairing prompt.

## Local data and offline use

The service worker caches the app shell and previously loaded assets. Once cached, the dashboard can reopen without internet access and continue talking to Veetr over Bluetooth.

Sensor history is stored only in the current browser's IndexedDB database. Samples are averaged into ten-second records, with automatic cleanup to keep the database bounded. Clearing the browser's site data removes that history.

Offline support has practical limits:

- A fresh installation needs internet access for its first load.
- Map tiles that were not previously loaded need an internet connection.
- Checking for or downloading a firmware release needs GitHub access.
- Web Bluetooth availability still depends on the operating system and browser.

## Dashboard and controls

The main view combines a large wind-direction instrument with compact cards for apparent wind, true wind, speed, heading, starting-line distance, and heel. The map uses stored GPS readings to draw the sailed track.

Settings provide Bluetooth status, heel calibration, device naming, regatta-line controls, firmware version and updates, theme selection, and diagnostics for long-running installed sessions.

## Source and development

- Application entry point: [`app/src/main.tsx`](https://github.com/veetrlabs/veetr/blob/main/app/src/main.tsx)
- BLE connection and state: [`app/src/context/BLEContext.tsx`](https://github.com/veetrlabs/veetr/blob/main/app/src/context/BLEContext.tsx)
- Instruments and controls: [`app/src/components/`](https://github.com/veetrlabs/veetr/tree/main/app/src/components)
- Local history: [`app/src/utils/dataStorage.ts`](https://github.com/veetrlabs/veetr/blob/main/app/src/utils/dataStorage.ts)
- Shared data types: [`packages/shared/`](https://github.com/veetrlabs/veetr/tree/main/packages/shared)

Use the **[development guide](https://veetr.org/docs/development/)** to run the PWA locally. For the other half of the system, see **[Firmware](https://veetr.org/docs/firmware/)**.

