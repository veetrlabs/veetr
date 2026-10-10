---
title: Software overview
description: How Veetr firmware, native apps, the web dashboard, and race management work together.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/SOFTWARE.md
---

Veetr brings together **firmware inside Veetr Vane**, **native apps for iPhone and Android**, a **Progressive Web App (PWA)**, and **race management on the website**. Use the phone app to record sailing with phone GPS, add Veetr Vane for instrument data, or join a race organized on the website.

## The software parts

| Software | Runs on | Main responsibility |
| --- | --- | --- |
| **[Firmware](https://veetr.org/docs/firmware/)** | The ESP32 inside Veetr | Reads the wind, GPS, and motion sensors; calculates derived values; stores device settings; and publishes sailing data over BLE. |
| **[Progressive Web App](https://veetr.org/docs/pwa/)** | A compatible web browser | Connects to Veetr, turns its data into sailing instruments, stores recent readings locally, shows the track map, and manages the device. |

| **[Native apps](/docs/native-apps/)** | iPhone and Android | Display instruments, record trips, show race courses, and provide start-line and anchor tools. Phone GPS recording works without Veetr Vane. |
| **[Race management](/docs/race-guide/)** | The Veetr website | Organizes series, invitations, courses, heats, tracking, and results for referees, sailors, and spectators. |

## From sensor to screen

1. The firmware reads the ultrasonic wind sensor over RS485, the GPS receiver over UART, and the IMU over I²C.
2. It validates the readings and calculates values such as true wind speed and angle.
3. About once per second, it sends a compact JSON message through a BLE notification.
4. The native app or PWA translates that message into speed, wind, heading, heel, GPS, and starting-line displays.
5. Commands travel in the other direction when you calibrate the unit, rename it, configure a starting line, or start an update.

```text
Wind + GPS + IMU → ESP32 firmware → Bluetooth LE → Native app or PWA → instruments and local history
                                              ← device commands and firmware updates
```

## Direct instrument connection

The live instrument connection is between your display device and Veetr Vane over Bluetooth; it does not need a cloud service. The PWA stores sailing history in that browser's IndexedDB database, while the ESP32 stores its device settings in non-volatile memory. Neither is uploaded to a Veetr account.

Internet access is useful for loading or updating the PWA, checking GitHub for a new firmware release, and downloading map tiles. The cached app interface and an already established BLE connection can continue without internet access.

Native apps also store recordings on the phone. Race invitations, live position sharing, and account features use online services. See the [native-app reference](/docs/native-apps/) and [recording and sharing guide](/docs/share-your-trip/) for those workflows.

## Choose what you need

- **Using the phone app:** read the [native-app reference](/docs/native-apps/), or [view screenshots and request beta access](/docs/mobile-apps/).
- **Using Veetr:** start with the **[user setup guide](https://veetr.org/docs/)**, then use the **[firmware update guide](https://veetr.org/docs/firmware-update/)** when needed.
- **Understanding the device:** read the **[firmware](https://veetr.org/docs/firmware/)** and **[PWA](https://veetr.org/docs/pwa/)** reference pages.
- **Contributing code:** use the **[development guide](https://veetr.org/docs/development/)** and **[PlatformIO configuration](https://veetr.org/docs/platformio/)**.

