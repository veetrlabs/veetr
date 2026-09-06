---
title: Hardware reference
description: Prototype interfaces, data rates, power estimates, firmware behavior, and environmental limits.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/HARDWARE_REFERENCE.md
---

This page collects the lower-level values used by the current prototype. Treat them as implementation details and test targets, not certified product specifications.

## Controller configuration

| Item | Current prototype |
| --- | --- |
| Controller | ESP32-WROOM-32U on a DevKitC-style board |
| Framework | Arduino on Espressif32 |
| Firmware storage | 4 MB flash on the referenced module |
| BLE | Custom sailing-data service |
| I²C | IMU on GPIO21/GPIO22 |
| GPS UART | RX GPIO16, TX GPIO17 |
| RS485 UART | RX GPIO32, TX GPIO33, DE/RE GPIO14 |

## Data handled by the firmware

- **GPS:** position, speed over ground, course over ground, satellite count, and signal status.
- **Wind:** apparent wind speed and direction plus derived true-wind values.
- **Motion:** heading, heel, pitch, and other orientation values supplied by the IMU.
- **System:** connection state, configuration, and available error information.

## Prototype update rates

| Source | Typical setting | Configurable range or limit |
| --- | --- | --- |
| GPS | 1 Hz | Receiver-dependent, commonly up to 10 Hz |
| IMU | 10 Hz | Sensor-dependent, commonly up to 100 Hz |
| Wind | 1–5 Hz | Sensor and Modbus configuration dependent |
| BLE combined stream | 10 Hz target | Depends on connection and enabled values |

## Power

| State | Prototype estimate |
| --- | --- |
| Normal operation | About 200 mA at 5 V |
| Short peak | Up to about 400 mA |
| Source | 5 V USB-C power bank or development computer |
| Sleep | Future work; not a current product claim |

Actual consumption depends on the ESP32 board, sensor variants, antennas, update rates, and firmware build. Measure your assembled unit before choosing a battery for a long sail.

## Configuration behavior

The firmware is designed to support:

- Wind-direction offset and magnetic-declination settings
- Configurable sensor polling intervals
- BLE device and connection settings
- Factory reset to default settings
- Sensor failure reporting and continued operation with available sensors
- Watchdog recovery from a stalled controller

See **[Data storage](https://veetr.org/docs/storage/)** for the current configuration files and persistence behavior.

## Environmental limits

The individual modules may carry wide temperature or humidity figures in their vendor listings. Those component ratings do not certify the assembled Veetr unit.

- Water resistance depends on the printed enclosure, seals, cable entries, assembly quality, and testing.
- Antenna range depends on placement, antenna choice, enclosure material, and the boat environment.
- Vibration, UV exposure, salt water, and condensation require validation on the complete assembly.
- The prototype is not a certified navigation or safety instrument.

See **[Compliance and certifications](https://veetr.org/docs/compliance/)** before describing or distributing a completed unit.

## Software and development tools

- VS Code with PlatformIO
- PlatformIO build, upload, and serial-monitor commands
- The Veetr web app for BLE integration testing

See the **[software overview](https://veetr.org/docs/software/)** for how the firmware and PWA divide the work. Continue to the **[development guide](https://veetr.org/docs/development/)** and **[PlatformIO configuration](https://veetr.org/docs/platformio/)** to work on the code.
