---
title: Wiring
description: User-friendly connection tables for the Veetr sensors, ESP32, antennas, controls, and power.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/WIRING.md
---

Use this page when assembling or troubleshooting the current Veetr prototype. It shows only the connections Veetr uses; you do not need to decode the complete ESP32 pinout.

> **Before connecting anything:** disconnect USB power, check the labels on your exact module revisions, and verify supply voltages with a multimeter. Never connect the wind sensor’s RS485 `A` or `B` line directly to an ESP32 pin.

## Enclosure connections

With the recessed connector panel facing you, connect the ports from left to right:

| Position | Port | Connects to | Notes |
| --- | --- | --- | --- |
| 1 | RJ45 | Ultrasonic wind sensor | Carries the wind-sensor cable into the enclosure |
| 2 | BLE antenna connector | External 2.4 GHz antenna | Connect before closing the enclosure |
| 3 | USB-C | Power bank or development computer | Powers the unit and programs the ESP32 |
| 4 | GPS antenna connector | External GPS antenna | Uses the thin GPS coaxial lead |

## Veetr pin map

These are the ESP32 signals used by the prototype:

| ESP32 pin | Connected device | Signal | Direction |
| --- | --- | --- | --- |
| 3V3 | IMU and compatible logic modules | 3.3 V supply | Power out |
| GND | All modules | Common ground | — |
| GPIO21 | BNO080/BNO085 | I²C SDA | Bidirectional |
| GPIO22 | BNO080/BNO085 | I²C SCL | Output |
| GPIO16 | GPS module TX | UART RX | Input |
| GPIO17 | GPS module RX | UART TX | Output |
| GPIO32 | RS485 converter RO | UART RX | Input |
| GPIO33 | RS485 converter DI | UART TX | Output |
| GPIO14 | RS485 converter DE/RE | Transmit/receive enable | Output |
| GPIO0 / BOOT | Pairing lid control | Pairing/discovery button | Input |
| EN / RESET | Reset lid control | Controller reset | Input |
| GPIO2 | Status LED | Status indication | Output |
| GPIO25 | Optional masthead LED control | Anchor-light control | Output |

## IMU wiring

| BNO080/BNO085 | ESP32 |
| --- | --- |
| `VCC` | `3V3` |
| `GND` | `GND` |
| `SDA` | `GPIO21` |
| `SCL` | `GPIO22` |

## GPS wiring

UART labels cross over: the GPS transmitter goes to the ESP32 receiver.

| GPS module | ESP32 |
| --- | --- |
| `VCC` | Supply accepted by your breakout board |
| `GND` | `GND` |
| `TX` | `GPIO16` / ESP32 RX |
| `RX` | `GPIO17` / ESP32 TX |

## Wind sensor and RS485 converter

The converter sits between the wind sensor and ESP32.

### Sensor side

| Wind sensor | RS485 converter |
| --- | --- |
| `A` or `A+` | `A` or `A+` |
| `B` or `B-` | `B` or `B-` |
| Supply positive | Supply required by the sensor |
| `GND` | Common `GND` |

If no data arrives, first confirm the manufacturer’s `A`/`B` naming. Some vendors label the differential pair in reverse.

### ESP32 side

| RS485 converter | ESP32 |
| --- | --- |
| Logic `VCC` | Supply supported by the converter and ESP32 logic |
| `GND` | `GND` |
| `RO` / receiver output | `GPIO32` |
| `DI` / driver input | `GPIO33` |
| `DE` and `RE` | `GPIO14` |

## Lid controls

The enclosure does not add separate electrical switches. Its two flexible printed tabs press the buttons already fitted to the ESP32 board:

| Lid control | ESP32 button | Result |
| --- | --- | --- |
| Reset | `EN` / `RESET` | Restarts the controller |
| Pairing | `BOOT` / `GPIO0` | Starts the firmware’s pairing/discovery action |

Align the ESP32 carefully so each lid tab presses the intended button without holding it down when the lid is installed.

## First power-on checklist

1. Inspect for solder bridges, reversed modules, and loose strands.
2. Confirm that every module shares a common ground.
3. Check each module’s supply-voltage label.
4. Leave the external wind sensor disconnected for the first USB power test.
5. Connect USB-C and confirm the ESP32 power indicator behaves normally.
6. Add the IMU and GPS one at a time and check the serial log after each step.
7. Connect the RS485 converter, then the wind sensor last.

For build, upload, and serial-monitor commands, continue to **[PlatformIO configuration](https://veetr.org/docs/platformio/)**.
