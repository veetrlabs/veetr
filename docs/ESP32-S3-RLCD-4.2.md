# Developer Documentation: Waveshare ESP32-S3-RLCD-4.2 AIoT Platform

This document provides the necessary technical specifications, pin mappings, and peripheral implementation details for developing firmware for the **Waveshare ESP32-S3-RLCD-4.2** development board.

---

## 1. System Overview
The platform is an AIoT development board centered on the **ESP32-S3-WROOM-1-N16R8** module. It features a unique **4.2-inch Reflective LCD (RLCD)** that offers an e-paper-like reading experience with faster refresh rates and lower power consumption than traditional backlit TFTs.

### Core Specifications
*   **Processor:** Xtensa 32-bit LX7 dual-core, up to 240 MHz.
*   **Memory:** 512 KB internal SRAM, 16 MB external SPI Flash, and **8 MB Octal PSRAM**.
*   **Display:** 4.2" RLCD, 300 × 400 resolution, 2-level monochrome (Black/White).
*   **Wireless:** 2.4 GHz Wi-Fi (802.11 b/g/n) and Bluetooth 5 (LE).
*   **Audio:** Dual-microphone array (ES7210 ADC) and speaker output (ES8311 DAC).
*   **Sensors:** SHTC3 Temperature/Humidity sensor and PCF85063 RTC.

---

## 2. Complete GPIO Pin Mapping
Firmware implementations must strictly adhere to the following hardware assignments to avoid bus contention or component failure:

| GPIO | Function | Description |
| :--- | :--- | :--- |
| **GPIO0** | **BOOT Button** | Active Low; used for Flash mode or custom input. |
| **GPIO4** | **Battery Sensing** | Analog Input (ADC1_CH3) with a 3x voltage divider. |
| **GPIO5** | **RLCD DC** | Data/Command selection for ST7305 controller. |
| **GPIO8** | **I2S DOUT** | Digital Audio Out to ES8311 DAC (Speaker). |
| **GPIO9** | **I2S BCLK** | Shared Bit Clock for Audio DAC and ADC. |
| **GPIO10** | **I2S DIN** | Digital Audio In from ES7210 ADC (Microphones). |
| **GPIO11** | **SPI SCLK** | High-speed Serial Clock for the RLCD. |
| **GPIO12** | **SPI MOSI** | Serial Data Out to the RLCD. |
| **GPIO13** | **I2C SDA** | Shared I2C Data bus for sensors and codecs. |
| **GPIO14** | **I2C SCL** | Shared I2C Clock bus. |
| **GPIO16** | **I2S MCLK** | Master Clock reference for audio codecs. |
| **GPIO18** | **KEY Button** | Customizable User Button (Active Low). |
| **GPIO40** | **RLCD CS** | SPI Chip Select (Active Low). |
| **GPIO41** | **RLCD RST** | Display Hardware Reset (Active Low). |
| **GPIO45** | **I2S LRCLK** | Word Select / Left-Right Clock for Audio. |
| **GPIO46** | **Speaker EN** | Active High; must be enabled to power the speaker amp. |

---

## 3. Peripheral Implementation Details

### 3.1 Reflective LCD (ST7305)
The display is driven by the **Sitronix ST7305** controller (or compatible ST7306 in some environments).
*   **Memory Architecture:** The controller uses a non-standard memory packing. For the 400x300 landscape mode, pixels are packed in **2 columns by 4 rows per byte**.
*   **PSRAM Requirement:** **Octal PSRAM must be enabled** (40MHz or 80MHz) to store the frame buffer and lookup tables (LUTs) used for rendering.
*   **Library Support:** Use `u8g2` (constructor `U8G2_ST7305_300X400_F_4W_HW_SPI`) or the `ST7305_MonoTFT_Library`.

### 3.2 Audio Subsystem
*   **Playback (ES8311):** Driven via I2S. Ensure **GPIO46** is driven **High** to enable the Class-D amplifier.
*   **Capture (ES7210):** Supports a dual-microphone array with hardware echo cancellation.
*   **Sample Format:** Standardized for AI interaction at **16-bit, 16 kHz mono PCM**.

### 3.3 Sensors and Monitoring
*   **SHTC3 (I2C 0x70):** Provides relative humidity and temperature.
*   **PCF85063 (I2C):** Real-time clock for persistent timekeeping.
*   **Battery Voltage:** Read from **GPIO4**. Calculate true voltage using: `V_bat = V_adc_pin * 3.0`.

---

## 4. Development Framework Setup

### Arduino IDE
*   **Board Selection:** `ESP32S3 Dev Module`.
*   **Flash Mode:** QIO 80MHz.
*   **PSRAM:** **OPI PSRAM (8MB)** must be enabled in the Tools menu.
*   **USB CDC:** Enable "USB CDC On Boot" to use the Serial Monitor via the Type-C port.

### ESP-IDF
*   **Version:** Recommended **v5.3.1 or later**.
*   **Component Configuration:** Use `menuconfig` to enable **Octal PSRAM** support and set the CPU frequency to 240 MHz.

### ESPHome
*   Requires a custom external component for the display controller: `kylehase/ESPHome-ST7305-RLCD`.
*   **Critical YAML Settings:**
    ```yaml
    psram:
      mode: octal
      speed: 80MHz
    ```
*   Failing to enable PSRAM will result in an "unspecified display failure".

---

## 5. Critical Handling Notes
*   **Mechanical Fragility:** The RLCD is glass-backed and has no bezel. **Do not apply pressure to the screen** when plugging in cables or inserting the 18650 battery.
*   **Mounting:** Use only **M2.5x6 screws** for the mounting holes. Longer screws will penetrate the PCB and shatter the RLCD panel.
*   **Power Management:** The physical **PWR button** handles power-on (short press) and safe shutdown (long press).
