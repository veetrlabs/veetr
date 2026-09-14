# RLCD DevBoard to Sensor Board Wiring

This document maps each external sensor board to the corresponding pins on the **Waveshare ESP32-S3-RLCD-4.2** devboard. The canonical source of truth for firmware pin definitions is [`firmware/include/board/pins_esp32s3_rlcd.h`](../firmware/include/board/pins_esp32s3_rlcd.h).

## Quick Reference

All sensor signals use GPIOs accessible on the **2×8 expansion header (P1)** — no soldering to module edge castellations required.

| Sensor | Interface | RLCD Pin | Header P1 | Old DevKitC Pin |
|---|---|---|---|---|
| **BNO080 IMU** | I2C | GPIO13 (SDA) | Pin 14 | GPIO21 |
| | | GPIO14 (SCL) | Pin 16 | GPIO22 |
| **RS485 Wind Sensor** | UART2 | GPIO1 (RX) | Pin 7 | GPIO32 |
| | | GPIO17 (TX) | Pin 13 | GPIO33 |
| | | GPIO3 (DE/RE) | Pin 11 | GPIO14 |
| **GPS Module** | UART1 | GPIO43 (RX) | Pin 10 | GPIO17 |
| | | GPIO44 (TX) | Pin 12 | GPIO16 |
| **Discovery Button** | GPIO input | GPIO18 (KEY) | Pin 15 | GPIO0 |
| **Discovery LED** | GPIO output | GPIO2 | Pin 9 | GPIO2 |
| **Anchor Light** | GPIO output | GPIO20 | Pin 8 | GPIO25 |

> **Legend:** Pins shown with grey background were **available on the DevKitC but NOT on the RLCD 2×8 header** and have been rerouted. Pins shown with white background are unchanged.

---

## 1. BNO080 IMU (I2C)

The BNO080 shares the RLCD-4.2 onboard I2C bus with the SHTC3 temp/humidity sensor (0x70) and PCF85063 RTC (0x51). The BNO080 at address **0x4A** has no conflict.

```
BNO080  →  RLCD-4.2
VCC     →  3.3V
GND     →  GND
SDA     →  GPIO13
SCL     →  GPIO14
```

| Signal | RLCD GPIO | Old DevKitC GPIO |
|---|---|---|
| SDA | 13 | 21 |
| SCL | 14 | 22 |

- I2C is configured for 400 kHz Fast Mode in firmware.
- An explicit `Wire.beginTransmission(0x4A)` probe is performed at boot to confirm presence.

---

## 2. RS485 Wind Sensor (UART2)

An RS485-to-TTL converter (MAX485/SP3485) sits between the ESP32 UART and the wind sensor differential pair.

```
RS485 Module  →  RLCD-4.2 header P1
VCC           →  Pin 1 (3.3V) or Pin 2 (VBUS 5V)
GND           →  Pin 3 or 4 (GND)
DI (TX)       →  Pin 13 — GPIO17      (ESP32 TX → RS485 input)
RO (RX)       →  Pin  7 — GPIO1       (RS485 output → ESP32 RX)
DE/RE         →  Pin 11 — GPIO3       (ESP32 GPIO controls TX/RX direction)
```

| Signal | RLCD GPIO | Header P1 | Old DevKitC GPIO | Note |
|---|---|---|---|---|
| RX (RO) | 1 | 7 | 32 | unchanged |
| TX (DI) | 17 | 13 | 33 | unchanged |
| DE/RE | **3** | 11 | 14 | was GPIO42 (module-only), now on header |

- Wind sensor: ultrasonic, RS485 Modbus RTU, 9600 baud, 8E1 (IEEE754 float format).
- Firmware uses `HardwareSerial rs485(RS485_UART)` with UART number 2.
- DE/RE is driven LOW initially (receive mode); `preTransmission` / `postTransmission` callbacks toggle it HIGH during Modbus requests.
- GPIO3 is the SD card chip-select. The SD card slot is unused in this design, so there is no conflict.

---

## 3. GPS Module (UART1)

```
GPS Module  →  RLCD-4.2 header P1
VCC         →  Pin 1 (3.3V) or Pin 2 (VBUS 5V)
GND         →  Pin 3 or 4 (GND)
TX          →  Pin 10 — GPIO43      (GPS TX → ESP32 RX)
RX          →  Pin 12 — GPIO44      (ESP32 TX → GPS RX)
```

| Signal | RLCD GPIO | Header P1 | Old DevKitC GPIO | Note |
|---|---|---|---|---|
| RX (GPS TX) | **43** | 10 | 17 | was GPIO6 (not on header) |
| TX (GPS RX) | **44** | 12 | 16 | was GPIO7 (not on header) |

- Chipset: u-blox NEO-8M, NMEA 0183 at 9600 baud.
- Firmware uses `HardwareSerial gpsSerial(GPS_UART)` with UART number 1.
- GPIO43/GPIO44 are the UART0 default pins but are repurposed for UART1 here.
  Console output works through USB Serial/JTAG (GPIO19/GPIO20) — no debug UART is lost.

---

## 4. Discovery Button

The onboard **KEY** button (GPIO18) replaces the old BOOT button for discovery mode. It is active LOW with an internal pull-up.

| Signal | RLCD GPIO | Old DevKitC GPIO |
|---|---|---|
| Button input | 18 (KEY) | 0 (BOOT) |

- Short-press toggles BLE discoverability.
- Long-press (5+ seconds) factory resets calibration.

---

## 5. Discovery & Status LEDs

| Function | RLCD GPIO | Header P1 | Old DevKitC GPIO | Note |
|---|---|---|---|---|
| **Discovery LED** (BLE advertising) | **2** | 9 | 2 | was GPIO48 (module-only), now on header |
| **Anchor Light LED** (masthead control) | **20** | 8 | 25 | was GPIO47 (module-only), now on header |

- GPIO2 blinks rapidly during BLE discovery, solid when connected.
- GPIO20 controls an external MOSFET or relay for the masthead anchor light.
- GPIO20 is the USB D+ pin on the ESP32-S3, routed through a 22Ω resistor to the USB-C connector.
  Driving it as a digital output is safe; the series resistor prevents any bus conflict.
  USB Serial/JTAG is not used at runtime (programming is done via an external UART dongle on GPIO43/44 or via OTA).

---

## Pin Conflict Notes

- **All sensors now use GPIOs on the 2×8 expansion header P1.** No soldering to module edge castellations is required.

### Changes from the original DevKitC pinout

| Signal | DevKitC | RLCD (original) | RLCD (final, on header) | Reason |
|---|---|---|---|---|
| RS485 DE/RE | GPIO14 | GPIO42 (module-only) | **GPIO3** (P1-11) | DE/RE had to move from GPIO14 (now I2C SCL) |
| GPS RX | GPIO17 | GPIO6 (not on header) | **GPIO43** (P1-10) | GPIO6 not on header |
| GPS TX | GPIO16 | GPIO7 (not on header) | **GPIO44** (P1-12) | GPIO7 not on header |
| Discovery LED | GPIO2 | GPIO48 (module-only) | **GPIO2** (P1-9) | GPIO48 not on header |
| Anchor Light | GPIO25 | GPIO47 (module-only) | **GPIO20** (P1-8) | GPIO47 not on header |

### Onboard peripherals (do not reassign)

- The RLCD display occupies GPIO5, 11, 12, 40, 41 (SPI + control).
- The I2S audio subsystem occupies GPIO8, 9, 10, 16, 45, 46.
- The I2C bus (GPIO13/GPIO14) is shared with SHTC3, PCF85063, and the audio codecs.
- The BOOT button (GPIO0) and KEY button (GPIO18) are on P1-5 and P1-15 respectively.
- GPIO19/GPIO20 (P1-6/P1-8) are the USB Serial/JTAG pins; GPIO20 is used for the anchor light since USB is not needed at runtime.
- GPIO3 (P1-11) is the SD card CS — unused in this design, safe for RS485 DE/RE.

## Onboard I2C Bus Devices

| Address | Device | Function |
|---|---|---|
| 0x70 | SHTC3 | Temperature / Humidity |
| 0x51 | PCF85063 | Real-Time Clock |
| 0x4A | BNO080 (external) | 9-Axis IMU |
