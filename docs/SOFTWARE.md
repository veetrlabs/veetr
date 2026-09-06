---
title: Software overview
description: How the Veetr firmware and Progressive Web App work together over Bluetooth.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/SOFTWARE.md
---

Veetr has two software parts: **firmware inside the hardware unit** and a **Progressive Web App (PWA) on your phone, tablet, or computer**. They connect directly over Bluetooth Low Energy (BLE); the sailing data does not need to pass through a cloud service.

## The two parts

| Software | Runs on | Main responsibility |
| --- | --- | --- |
| **[Firmware](https://veetr.org/docs/firmware/)** | The ESP32 inside Veetr | Reads the wind, GPS, and motion sensors; calculates derived values; stores device settings; and publishes sailing data over BLE. |
| **[Progressive Web App](https://veetr.org/docs/pwa/)** | A compatible web browser | Connects to Veetr, turns its data into sailing instruments, stores recent readings locally, shows the track map, and manages the device. |

## From sensor to screen

1. The firmware reads the ultrasonic wind sensor over RS485, the GPS receiver over UART, and the IMU over I²C.
2. It validates the readings and calculates values such as true wind speed and angle.
3. About once per second, it sends a compact JSON message through a BLE notification.
4. The PWA translates that message into speed, wind, heading, heel, GPS, and starting-line displays.
5. Commands travel in the other direction when you calibrate the unit, rename it, configure a starting line, or start an update.

```text
Wind + GPS + IMU → ESP32 firmware → Bluetooth LE → Veetr PWA → instruments and local history
                                              ← device commands and firmware updates
```

## No account or cloud connection required

The live connection is between your display device and Veetr. The PWA stores sailing history in that browser's IndexedDB database, while the ESP32 stores its device settings in non-volatile memory. Neither is uploaded to a Veetr account.

Internet access is useful for loading or updating the PWA, checking GitHub for a new firmware release, and downloading map tiles. The cached app interface and an already established BLE connection can continue without internet access.

## Choose what you need

- **Using Veetr:** start with the **[user setup guide](https://veetr.org/docs/)**, then use the **[firmware update guide](https://veetr.org/docs/firmware-update/)** when needed.
- **Understanding the device:** read the **[firmware](https://veetr.org/docs/firmware/)** and **[PWA](https://veetr.org/docs/pwa/)** reference pages.
- **Contributing code:** use the **[development guide](https://veetr.org/docs/development/)** and **[PlatformIO configuration](https://veetr.org/docs/platformio/)**.

