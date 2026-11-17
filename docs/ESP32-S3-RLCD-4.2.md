# Veetr Vane v2 — ESP32-S3-RLCD-4.2 specification

Status: **prototype integration specification; final release pending qualification**. Reviewed **2026-11-17**.

This is the authoritative v2 configuration and pin-allocation document. The [hardware decision overview](RLCD_V2_HARDWARE.md) explains the selections and links alternatives, supplier evidence and v1 lessons. The [order and test plan](hardware/v2/PROTOTYPE_ORDER.md) defines the next build. [RLCD sensor wiring](RLCD_TO_SENSORS.md) describes the existing PoC, and the [firmware header](../firmware/include/board/pins_esp32s3_rlcd.h) defines the currently implemented pin values.

New prototype purchases must satisfy the [production component selection](hardware/v2/PRODUCTION_SELECTION.md): whole-board material-compliance evidence, a traceable sourcing route and confirmed supply/revision. Existing reference hardware does not waive that requirement. The RLCD controller’s whole-board evidence is still an open procurement gate.

## Configuration baseline

| Subsystem | Target configuration | Qualification state |
| --- | --- | --- |
| Controller | Waveshare ESP32-S3-RLCD-4.2, ESP32-S3-WROOM-1-N16R8 | Existing platform; received PCB revision must match documented routing |
| Display | Onboard reflective display | Preserve working driver; front illumination under development |
| Wind | Existing ultrasonic Modbus head, 9600 baud 8E1, 3.3 V-compatible RS485 interface | Preserve PoC wiring; 5 V battery supply and production interface open |
| GNSS | SparkFun GPS-18037 MAX-M10S on 3.3 V Qwiic I²C | Preferred prototype; UART GNSS remains in working PoC |
| IMU | Existing BNO080 for regression; Adafruit 4754 BNO085 for new-build evaluation | Shared-bus compatibility gate |
| NMEA2000 | TWAI + Olimex A20-CAN-ISO; local 5 V / 3.3 V logic; isolated bus domain | Electrical integration and firmware pending |
| SD | Onboard socket, one-bit SDMMC; Kingston SDCIT2/8GB candidate | Concurrent sensor/logging and power-loss qualification pending |
| Network power | Protected isolated network-to-5 V input with USB/source selection | Required carrier provision; exact module/circuit open; first build may leave input module unpopulated |
| Battery | Compatible protected single-cell pack and qualified charging/power path | Exact cell and protected switched battery access unresolved |
| External 5 V | Pololu 2562 wind boost candidate; 4085 load alternative | Final converter/count depends on measurements |
| Radio | Preserve BLE; ESP32-S3 Wi-Fi available | Wi-Fi application and coexistence qualification pending |
| Barometer / vent | Adafruit 4816 BMP390, BOPLA DAE M12 9005 / 52042000, recessed draining splash shield | Included in prototype BOM; sensor availability, enclosure seal and pressure response to qualify |
| Optional lighting | VEML7700 ambient light; front-light driver | Optical/driver design pending |

## Verified wiring

The official schematic and SDMMC example specify the following connections:

| SD1 signal | Schematic net | ESP32 GPIO | Evidence |
| --- | --- | --- | --- |
| Pin 3 CMD | MOSI | **21** | Schematic SD-CARD block and example constructor |
| Pin 5 CLK | SCK | **38** | Same two independent sources |
| Pin 7 D0 | MISO | **39** | Same two independent sources |
| Pin 2 DAT3 / SPI CS | SDCS | **17 only through R7** | R7 is marked **NC**, not populated in the documented design |
| DAT1 / DAT2 | No MCU connection | None | One-bit design |

Evidence revision: the [official schematic][ws-sch], SD-CARD, U1 and P1 blocks; SHA-256 `63e679d106253ac6ce8c4eaa69610f34f879660f372953f15e259fc2a7dac1aa`. Waveshare can replace that URL without changing its name; compare the purchased PCB revision.

The [official Arduino header][ws-sdh], at vendor commit `eb1f63427d735a22b9c30e22fa63ebddae1834d3`, declares `CustomSDPort(..., int clk = 38, int cmd = 21, int d0 = 39, int width = 1)`. Its [implementation][ws-sdc] assigns these parameters to `slot_config` and calls `esp_vfs_fat_sdmmc_mount`. The [06_SD_Card sketch][ws-demo] constructs the default port and performs file write/read operations. The [vendor walkthrough][ws-arduino] agrees that it uses SDMMC.

Before using SD and RS485 together, confirm R7 is unpopulated and check the GPIO17-to-DAT3 path with the board unpowered. A populated R7 connects RS485 TX to DAT3 and can interfere with SD startup. Such a board variant requires a revised wiring design.

GPIO3 is a **JTAG-selection strapping pin**, exposed on P1-11. Check reset-time bias and external DE/RE loading against the [ESP32-S3 datasheet][s3-data]. Its use as DE/RE after reset is separate from its strap function.

### P1 header allocation

Pin numbers follow the schematic, not an assumed view of the connector. Confirm pin 1 and mating orientation mechanically.

| P1 | Board signal | Current RLCD firmware / wiring | Proposed v2 carrier, pending validation |
| --- | --- | --- | --- |
| 1 | VCC3V3 | Sensor supply as rated | 3.3 V logic supply; establish current margin |
| 2 | VBUS | USB 5 V | **USB VBUS, not battery-backed regulated 5 V** |
| 3, 4 | GND | Local ground | Local ground, not isolated CAN ground |
| 5 | GPIO0 | BOOT | Preserve BOOT, do not use for CAN |
| 6 | GPIO19 | USB D- | Preserve runtime USB |
| 7 | GPIO1 | RS485 RX | Unchanged, transceiver RO → MCU |
| 8 | GPIO20 | USB D+ | Preserve runtime USB |
| 9 | GPIO2 | Discovery LED | Keep LED; optional service/reset routing needs separate design |
| 10 | GPIO43 | GNSS UART TX | **Proposed CAN TX → transceiver TXD** |
| 11 | GPIO3 | RS485 DE and /RE | Unchanged; verify reset strapping |
| 12 | GPIO44 | GNSS UART RX | **Proposed CAN RX ← transceiver RXD** |
| 13 | GPIO17 | RS485 TX | Unchanged, only after confirming R7 absent |
| 14 | GPIO13 | I²C SDA | IMU + proposed GNSS SDA + onboard devices |
| 15 | GPIO18 | KEY / discovery | Unchanged |
| 16 | GPIO14 | I²C SCL | IMU + proposed GNSS SCL + onboard devices |

**Do not connect CAN and the existing UART GNSS simultaneously to GPIO43/44.** The GNSS conversion must first pass regression tests and be selected explicitly in a future v2 firmware profile. The current RLCD image emits GNSS UART traffic on these pins and is incompatible with that rewired carrier. Include a hardware CAN-disable provision, default recessive TXD, and boot-ROM UART43 behavior in the carrier review; software startup alone cannot prevent reset-time CAN disturbance.

Other reservations, verified from Waveshare schematic and current firmware:

| Function | GPIO / resource | v2 requirement |
| --- | --- | --- |
| Display | DC5, TE6, CLK11, MOSI12, CS40, RESET41 | Preserve; TE is wired even if driver ignores it |
| SDMMC | CMD21, CLK38, D0 39 | Onboard routing, no P1 pins consumed |
| Battery measurement | ADC4, 200 kΩ / 100 kΩ divider | Nominal 3× conversion; calibrate and test under load |
| RTC interrupt | 15 | Onboard, not spare header I/O |
| Audio | 8, 9, 10, 16, 45, 46 | Leave reserved; no module-edge soldering proposed |
| Flash / PSRAM | WROOM N16R8 resources | Do not reclaim internal memory pins |
| BLE and Wi-Fi | Internal radio | No additional P1 pins; shared RF/CPU/power budget |

## Shared I²C interface

Provide at least three 3.3 V Qwiic/STEMMA QT ports on the prototype carrier: JST-SH 1.0 mm, pin 1 GND, pin 2 3.3 V, pin 3 SDA, pin 4 SCL. Confirm numbered connector footprints and mating orientation against the [connector specification][qt-spec]. Ports share the same bus; their physical location is not identifiable in software. Modules require independent mechanical support.

| Device | Address | Interface condition |
| --- | --- | --- |
| MAX-M10S preferred GNSS | `0x42` | Native Qwiic; no dedicated PPS/reset through four-wire cable |
| BNO08x IMU | `0x4A`, alternate `0x4B` | Protocol identity and recovery tests required |
| PCF85063 RTC | `0x51` | Onboard |
| SHTC3 | `0x70` | Onboard |
| Optional VEML7700 | `0x10` | Verify module revision and pull-ups |
| Prototype BMP390 | `0x77`, alternate `0x76` | Protected enclosure vent; pressure response and ingress qualification pending |
| LC76G challenger | `0x50` / `0x54` command/data interfaces | Different protocol and connector; not a direct Qwiic substitute |

Inventory audio codec addresses and pull-ups as well before freezing the bus. Existing firmware uses 400 kHz. Begin with short cables (100 mm each), establish total pull-up resistance and rise times, then test the actual combined workload. SparkFun's 2.2 kΩ pull-ups are disconnected by default; the Adafruit BNO085 board has 10 kΩ pull-ups. All bus pull-ups must remain at 3.3 V.

Adafruit documents BNO085 I²C difficulties on ESP32-S3. An address scan is insufficient: require bounded reads, per-source data-age measurements, timeouts and recovery. If four-wire shared-bus operation fails, revise the architecture before releasing the carrier. Retaining UART GNSS would require a different CAN arrangement or more exposed MCU pins. See [GNSS](hardware/v2/GNSS.md), [IMU](hardware/v2/IMU.md) and [assembly](hardware/v2/ASSEMBLY_AND_OPTIONS.md).

## Power and external connections

P1 supplies USB VBUS and regulated 3.3 V. The protected, switched battery connection for the boost and the external-power selection/charging path remain carrier design gates. Do not connect boost output to USB VBUS or bypass battery protection. Establish charger behavior, cutoff, polarity and current margin using the actual cell and board. [Power decision](hardware/v2/POWER.md) owns converter comparisons and the measurement budget.

Keep local ground and the network-side CAN/power reference separate. NMEA2000 NET-S/NET-C supply a protected **isolated** network-to-5 V input. With that option fitted and validated, a powered NMEA cable runs Veetr without USB and supports charging within the declared network load budget. USB remains an alternative supply, and battery operation continues when external power disappears.

The first carrier must reserve a documented module interface, mounting/keepout area, protection and source-selection circuitry for this input. It may ship as a bench prototype with the network-power module unpopulated, leaving NET-S safely disconnected from local rails. Freeze either the exact converter footprint or a keyed daughterboard interface before fabrication. Resolve the Waveshare USB VBUS connection so simultaneous USB/network use cannot backfeed either source; this cannot be deferred to a simple future jumper. [Power requirements and staging](hardware/v2/POWER.md#nmea2000-power-and-first-carrier-provision) define the implementation gates.

Use a keyed NMEA2000 drop connection with surge/ESD protection and strain relief; connector SKU, shield handling and protection network remain unresolved. An ordinary drop has no enabled termination. [Marine interfaces](hardware/v2/INTERFACES.md) defines the selected module mating connections and network scope.

No GPIO has been allocated for the night-light driver, auxiliary IMU reset or GNSS PPS. Resolve any requirement for those signals before PCB layout. USB, BOOT, display and onboard peripheral pins remain reserved.

## Enclosure pressure path

Fit a BOPLA 52042000 vent behind a recessed splash shield with an indirect air path and exterior drainage. All drains remain outside the membrane/O-ring boundary. Provide a sealed mounting land, service access and room for the BMP390 pressure port to remain unobstructed. The [barometer decision](hardware/v2/ASSEMBLY_AND_OPTIONS.md#barometer-and-protected-pressure-vent) specifies prototype construction and pressure/ingress tests. A splash shield reduces exposure; it does not guarantee a dry vent under waves or immersion.

## Release gates

A final configuration requires passing the [prototype test stages](hardware/v2/PROTOTYPE_ORDER.md#test-stages), an exact revision-controlled BOM, approved mechanical drawings, completed power budget and appropriate [project compliance evidence](COMPLIANCE.md). GNSS I²C and CAN require a distinct firmware profile with safe startup behavior. Existing firmware pin definitions stay unchanged until that hardware is validated.

[ws-sch]: https://files.waveshare.com/wiki/ESP32-S3-RLCD-4.2/ESP32-S3-RLCD-4.2-schematic.pdf
[ws-sdh]: https://github.com/waveshareteam/ESP32-S3-RLCD-4.2/blob/eb1f63427d735a22b9c30e22fa63ebddae1834d3/02_Example/Arduino/06_SD_Card/sdcard_bsp.h
[ws-sdc]: https://github.com/waveshareteam/ESP32-S3-RLCD-4.2/blob/eb1f63427d735a22b9c30e22fa63ebddae1834d3/02_Example/Arduino/06_SD_Card/sdcard_bsp.cpp
[ws-demo]: https://github.com/waveshareteam/ESP32-S3-RLCD-4.2/blob/eb1f63427d735a22b9c30e22fa63ebddae1834d3/02_Example/Arduino/06_SD_Card/06_SD_Card.ino
[ws-arduino]: https://docs.waveshare.com/ESP32-S3-RLCD-4.2/Arduino#06_sd_card
[s3-data]: https://documentation.espressif.com/esp32_s3_datasheet_en.pdf
[qt-spec]: https://learn.adafruit.com/introducing-adafruit-stemma-qt/technical-specs
