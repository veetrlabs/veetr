# RLCD DevBoard to Sensor Board Wiring

This document maps each external sensor board to the corresponding pins on the **Waveshare ESP32-S3-RLCD-4.2** devboard. The canonical source of truth for firmware pin definitions is [`firmware/include/board/pins_esp32s3_rlcd.h`](../firmware/include/board/pins_esp32s3_rlcd.h).

## Quick Reference

| Sensor | Interface | RLCD Pins | Old DevKitC Pins (for reference) |
|---|---|---|---|
| **BNO080 IMU** | I2C | GPIO13 (SDA), GPIO14 (SCL) | GPIO21, GPIO22 |
| **RS485 Wind Sensor** | UART2 | GPIO1 (RX), GPIO17 (TX), GPIO42 (DE/RE) | GPIO32, GPIO33, GPIO14 |
| **GPS Module** | UART1 | GPIO6 (RX), GPIO7 (TX) | GPIO17, GPIO16 |
| **Discovery Button** | GPIO input | GPIO18 (KEY button) | GPIO0 (BOOT) |
| **Discovery LED** | GPIO output | GPIO48 | GPIO2 |
| **Anchor Light LED** | GPIO output | GPIO47 | GPIO25 |

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
RS485 Module  →  RLCD-4.2
VCC           →  3.3V or 5V
GND           →  GND
DI (TX)       →  GPIO17      (ESP32 TX → RS485 input)
RO (RX)       →  GPIO1       (RS485 output → ESP32 RX)
DE/RE         →  GPIO42      (ESP32 GPIO controls TX/RX direction)
```

| Signal | RLCD GPIO | Old DevKitC GPIO |
|---|---|---|
| RX (RO) | 1 | 32 |
| TX (DI) | 17 | 33 |
| DE/RE | 42 | 14 |

- Wind sensor: ultrasonic, RS485 Modbus RTU, 9600 baud, 8E1 (IEEE754 float format).
- Firmware uses `HardwareSerial rs485(RS485_UART)` with UART number 2.
- DE/RE is driven LOW initially (receive mode); `preTransmission` / `postTransmission` callbacks toggle it HIGH during Modbus requests.

---

## 3. GPS Module (UART1)

```
GPS Module  →  RLCD-4.2
VCC         →  3.3V or 5V
GND         →  GND
TX          →  GPIO6       (GPS TX → ESP32 RX)
RX          →  GPIO7       (ESP32 TX → GPS RX)
```

| Signal | RLCD GPIO | Old DevKitC GPIO |
|---|---|---|
| RX (GPS TX) | 6 | 17 |
| TX (GPS RX) | 7 | 16 |

- Chipset: u-blox NEO-8M, NMEA 0183 at 9600 baud.
- Firmware uses `HardwareSerial gpsSerial(GPS_UART)` with UART number 1.

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

| Function | RLCD GPIO | Old DevKitC GPIO |
|---|---|---|
| **Discovery LED** (BLE advertising) | 48 | 2 |
| **Anchor Light LED** (masthead control) | 47 | 25 |

- GPIO48 blinks rapidly during BLE discovery, solid when connected.
- GPIO47 controls an external MOSFET or relay for the masthead anchor light.

---

## Pin Conflict Notes

- **GPIO14** was RS485 DE/RE on the old DevKitC but is **I2C SCL** on the RLCD — the RS485 DE/RE was moved to **GPIO42**.
- **GPIO16** was GPS TX on the old DevKitC but is **I2S MCLK** on the RLCD — the GPS was moved to UART1 (GPIO6/GPIO7).
- **GPIO0** (BOOT button on both boards) is reserved for entering download mode on the RLCD and is no longer used as the discovery button.
- The RLCD display permanently occupies GPIO5, 11, 12, 40, 41 (SPI + control).
- The onboard I2S audio subsystem permanently occupies GPIO8, 9, 10, 16, 45, 46.

## Onboard I2C Bus Devices

| Address | Device | Function |
|---|---|---|
| 0x70 | SHTC3 | Temperature / Humidity |
| 0x51 | PCF85063 | Real-Time Clock |
| 0x4A | BNO080 (external) | 9-Axis IMU |
