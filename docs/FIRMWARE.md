---
title: Firmware
description: What runs on the Veetr ESP32, from sensor acquisition and calculations to BLE and updates.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/FIRMWARE.md
---

The Veetr firmware turns the enclosure's sensors into a single live sailing-data stream. It runs on the ESP32 using the Arduino framework and is built with PlatformIO.

## What the firmware does

- Reads position, speed over ground, course, satellite count, and accuracy from the GPS receiver.
- Reads apparent wind speed and direction from the ultrasonic wind sensor.
- Reads heading, heel, pitch, and acceleration from the BNO080 IMU when available.
- Filters low-speed GPS noise and calculates true wind from apparent wind and vessel motion.
- Continues publishing the values that remain available when an individual sensor fails.
- Advertises Veetr for pairing only during the physical discovery window.
- Sends telemetry and receives device commands over BLE.
- Installs release binaries sent by the PWA through the BLE update protocol.

## Hardware interfaces

| Input or control | Interface | ESP32 connection |
| --- | --- | --- |
| Ultrasonic wind sensor | RS485 / Modbus | RX GPIO32, TX GPIO33, DE/RE GPIO14 |
| GPS receiver | UART | RX GPIO16, TX GPIO17 |
| BNO080 IMU | I²C | SDA GPIO21, SCL GPIO22 |
| Pairing/discovery button | Digital input | GPIO0 |
| Discovery/status LED | Digital output | GPIO2 |

See **[Wiring](https://veetr.org/docs/wiring/)** for the assembly connections and **[Hardware reference](https://veetr.org/docs/hardware-reference/)** for the prototype values.

## BLE data and commands

The firmware is a BLE GATT server. A connected PWA subscribes to the sensor-data characteristic and receives UTF-8 JSON notifications, normally once per second. The compact field names include:

| Field | Meaning |
| --- | --- |
| `SOG`, `COG` | Speed and course over ground |
| `AWS`, `AWA` | Apparent wind speed and angle |
| `TWS`, `TWA` | Calculated true wind speed and angle |
| `HDM`, `hl` | Magnetic heading and heel |
| `lat`, `lon`, `sat`, `hdop` | GPS position and fix quality |
| `ln` | Signed distance from the configured regatta start line |
| `rssi` | BLE signal strength reported by the ESP32 |

The command characteristic lets the PWA reset the heel zero, rename the device, set or clear the two ends of a regatta line, request device and firmware information, and manage firmware updates.

## Pairing and discovery

Pressing the pairing control toggles BLE discovery. When enabled, the status LED is lit and the device advertises for up to five minutes. Existing connections can continue after advertising stops. This keeps Veetr from remaining discoverable throughout a sail.

The saved device name is used during advertising, which makes multiple Veetr units easier to distinguish.

## Settings and resilience

The firmware stores the device name, refresh rate, calibration values, and regatta-line coordinates in ESP32 non-volatile preferences. Sensor availability is handled independently: missing wind or motion data is omitted instead of stopping GPS and BLE operation.

Telemetry payloads are kept below the negotiated BLE limit. If a message is too large, lower-priority diagnostic values are removed before the core sailing values.

## Updating the firmware

The normal path is the updater in the PWA. It checks the latest GitHub release, downloads its firmware binary, transfers it in acknowledged BLE chunks, asks the ESP32 to verify it, and then applies it. A USB cable and PlatformIO or ESPTool provide the recovery path.

Follow the **[firmware update guide](https://veetr.org/docs/firmware-update/)** for user instructions.

## Source and development

- Main program: [`firmware/src/main.cpp`](https://github.com/veetrlabs/veetr/blob/main/firmware/src/main.cpp)
- Reusable firmware modules: [`firmware/include/`](https://github.com/veetrlabs/veetr/tree/main/firmware/include)
- Native unit tests: [`firmware/test/`](https://github.com/veetrlabs/veetr/tree/main/firmware/test)
- Build configuration: [`platformio.ini`](https://github.com/veetrlabs/veetr/blob/main/platformio.ini)

Use **[PlatformIO configuration](https://veetr.org/docs/platformio/)** to build and flash the firmware, and **[Firmware testing](https://veetr.org/docs/firmware-testing/)** for the test suites.
