---
title: Hardware overview
description: How the Veetr controller, sensors, antennas, and sailing dashboard work together.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/HARDWARE.md
---

Veetr is an ESP32-based sailing instrument. A portable controller reads the wind, motion, and GPS sensors, calculates the sailing data, and sends it to the Veetr web app over Bluetooth Low Energy (BLE).

![Veetr PCB installed in the prototype enclosure](../pcb/Veetr-in-box.jpg)

## At a glance

| Part | What it does | Connection |
| --- | --- | --- |
| ESP32 controller | Reads sensors, calculates values, and serves BLE data | Central controller |
| BNO080/BNO085 IMU | Measures orientation, heading, and heel | I²C |
| GPS module | Provides position and speed over ground | UART |
| Ultrasonic wind sensor | Measures apparent wind speed and direction | RS485 through a converter |
| Veetr web app | Displays the live instruments | BLE |

## How data moves through Veetr

1. The wind, GPS, and motion sensors send measurements to the ESP32.
2. The ESP32 combines those readings into sailing values such as true wind, heading, heel, and speed over ground.
3. BLE sends the current values to the Veetr web app.
4. The app can send configuration changes back to the controller.

## Physical connections

Looking at the recessed connector panel, the current enclosure presents these connections from left to right:

| Position | Connector | Purpose |
| --- | --- | --- |
| 1 | RJ45 | Ultrasonic wind sensor |
| 2 | SMA-style antenna connector | External BLE antenna |
| 3 | USB-C | Power and firmware programming |
| 4 | SMA-style antenna connector | External GPS antenna |

The two flexible controls in the lid press the ESP32’s onboard buttons. One resets the controller; the other starts pairing/discovery through the BOOT button.

## Design priorities

- **Modular:** Sensor breakout boards use standard pin headers and can be replaced individually.
- **Repairable:** A failed module does not require replacing the whole instrument.
- **Portable:** The prototype can run from a USB-C power bank instead of the boat’s electrical system.
- **Inspectable:** The PCB files, firmware, app, and documentation are open.
- **Adaptable:** Builders can test modules on a breadboard before installing them on the Veetr carrier PCB.

## Continue with

- **[Components](https://veetr.org/docs/components/):** choose the controller, sensors, antennas, converter, PCB, and enclosure.
- **[Wiring](https://veetr.org/docs/wiring/):** connect the modules and check each signal before applying power.
- **[Hardware reference](https://veetr.org/docs/hardware-reference/):** prototype interfaces, update rates, power estimates, and environmental limits.
- **[Data storage](https://veetr.org/docs/storage/):** understand configuration and filesystem behavior.
- **[Compliance and certifications](https://veetr.org/docs/compliance/):** understand what is and is not certified.
