# Controller, display and storage decision

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Order plan](PROTOTYPE_ORDER.md)

## Decision

Retain **Waveshare ESP32-S3-RLCD-4.2** for the next prototype. It is the existing standalone-display platform and integrates the SD socket, battery circuitry and radio. A different controller becomes necessary only if the shared I²C architecture or required auxiliary signals cannot fit the exposed header.

| Candidate | Features and assembly | Electrical / thermal evidence | Disposition |
| --- | --- | --- | --- |
| V1 DevKitC-style ESP32-WROOM-32U | Working BLE and sensors; external RF antenna; carrier headers; no integrated display/SD/battery system | 3.3 V logic, USB-powered board; recorded whole-unit estimates 200 mA normal / 400 mA peak at 5 V; exact board temperature limit unknown | Keep a complete v1 reference for regression. Adding separate display and power boards increases assembly and enclosure work |
| Waveshare ESP32-S3-RLCD-4.2 | Local reflective display, microSD, single-cell battery circuit, BLE/Wi-Fi; P1 carrier socket | USB VBUS and regulated 3.3 V exposed; full-assembly current and temperature envelope unqualified | Selected; scarce P1 pins make I²C GNSS a dependency for CAN |
| Separate ESP32-S3 board + display + SD/power boards | Could expose more GPIO and allow a different display | No exact alternative assembly selected; price/current/temperature unknown until a complete BOM exists | Architecture fallback, not an orderable substitute |

The RLCD radio implementation differs from v1's external-antenna arrangement. Preserve the antenna keepout and test range through the final wet enclosure. Reflective display readability relies on incident light; night use needs a front-light design, described in [assembly and options](ASSEMBLY_AND_OPTIONS.md). Battery charging limits and display limits may constrain the product more than the MCU rating.

## Storage choice

Use the onboard socket in **one-bit SDMMC** mode, as specified in the [canonical wiring map](../../ESP32-S3-RLCD-4.2.md#verified-wiring). No external SD breakout is required. The optional R7 connection must be checked on the actual PCB before concurrent wind/SD use.

| Candidate | Advantage | Tradeoff / decision |
| --- | --- | --- |
| Kingston SDCIT2/8GB industrial microSDHC | Exact procurement SKU; industrial pSLC family, supplier documentation | Preferred logging candidate; obtain current EU quote and temperature/endurance sheet for the exact suffix. Industrial branding does not prove power-loss recovery in Veetr |
| Existing consumer microSD | Low incremental cost; suitable for initial vendor write/read test | Keep as smoke-test media; unknown endurance and lifecycle make it unsuitable as the final specified card |
| Separate SD breakout | Can work on other controllers | Adds pins, cables and assembly without a benefit on this board; rejected |

Logs must tolerate removal and interrupted power. Use bounded buffering, timestamp/validity fields and a defined flush policy; test that SD activity cannot block sensor freshness. This feature requires firmware integration, not just card detection.

## Procurement, licensing and evidence

The [supplier register](SOURCING_AND_EVIDENCE.md) records RLCD and SD order links, price status and quantity gaps. Espressif publishes ESP32-S3 module certificates and a chip longevity commitment; neither guarantees the Waveshare board or display panel's lifetime. A whole-board temperature specification, exact-board EU declaration and production lead-time commitment remain open.

Waveshare publishes schematics and examples. Their availability alone does not establish a reusable open-hardware license for the complete board; inspect the license of any copied design or code separately. V1's exact development-board vendor and license are unrecorded. The Veetr repository's MIT license does not relicense vendor material.

## Acceptance and fallback

First run the vendor SD write/read example, then run display, BLE, wind and SD concurrently through repeated starts and USB/battery transitions. Record board revision, R7 population, current peaks and data age. Compare BLE range and usable display viewing angles with the v1 reference. If shared-bus or pin requirements fail, select a complete alternative controller configuration before designing a carrier; do not reclaim USB or BOOT ad hoc.

Sources: [Waveshare schematic][ws-sch], [vendor SD example][ws-demo], [Espressif longevity][longevity], [Espressif certificates][esp-cert], [Kingston exact part][sd-maker], [v1 component record](../../COMPONENTS.md), [v1 power estimates](../../HARDWARE_REFERENCE.md#power).

[ws-sch]: https://files.waveshare.com/wiki/ESP32-S3-RLCD-4.2/ESP32-S3-RLCD-4.2-schematic.pdf
[ws-demo]: https://github.com/waveshareteam/ESP32-S3-RLCD-4.2/blob/eb1f63427d735a22b9c30e22fa63ebddae1834d3/02_Example/Arduino/06_SD_Card/06_SD_Card.ino
[esp-cert]: https://www.espressif.com/en/support/documents/certificates
[sd-maker]: https://www.kingston.com/en/memory/search?partid=SDCIT2%2F8GB
[longevity]: https://www.espressif.com/en/products/longevity-commitment
