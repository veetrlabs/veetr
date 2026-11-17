# Controller, display and storage decision

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Order plan](PROTOTYPE_ORDER.md)

## Decision

Retain **Waveshare ESP32-S3-RLCD-4.2** for the next prototype. It is the existing standalone-display platform and integrates the SD socket, battery circuitry and radio. A different controller becomes necessary only if the shared I²C architecture or required auxiliary signals cannot fit the exposed header.

**★** = best documented fit for the row; **▼** = disadvantage for this v2 design; **?** = not established. Unmarked values are neutral or not directly comparable. Unknown evidence is not a failure.

Prices are **EUR excluding VAT**, unless marked otherwise. See the [supplier register](SOURCING_AND_EVIDENCE.md#price-and-quantity-snapshot) for dated quotes, conversions and stock. “Yes” in a compliance row applies only to the stated board, not the assembled Veetr product.

| Criterion | V1 ESP32-WROOM-32U development board | Waveshare ESP32-S3-RLCD-4.2 |
| --- | --- | --- |
| **Decision** | Working reference | **★ Selected prototype** |
| **Price, EUR net** | ? | €30–45 allowance; quote needed |
| **EU seller** | ? | [BerryBase][rlcd-eu] |
| **US seller** | ? | ? |
| **Listed stock** | ? | ? |
| Supply continuity | Exact board vendor unrecorded | S3 chip: 12 years from 2021; board commitment ? |
| **Quality evidence** | Working v1 integration | Existing PoC; schematic and examples |
| **Features** | BLE, Wi-Fi, external RF antenna | BLE, Wi-Fi, display, SD, battery circuitry |
| Local display / SD socket | ▼ Separate boards needed | **★ Integrated** |
| Battery charging | ▼ Separate circuit needed | **★ Integrated; power-path review pending** |
| **Supply / logic** | USB / 3.3 V | USB or single cell / 3.3 V |
| **Board current** | ? | ? |
| **Board operating temperature** | ? | ? |
| **Carrier connection** | Pin headers | P1 socket |
| **Assembly for v2** | ▼ Extra display/storage/power boards | **★ Integrated assembly** |
| GPIO flexibility | Existing UART sensor wiring | ▼ Limited P1 pins; I²C GNSS needed |
| **CE / EU DoC — board** | Unknown | Unknown |
| **RoHS — board** | Unknown | Unknown |
| **REACH / FCC — board** | Unknown / Unknown | Unknown / Unknown |
| **Hardware license** | ? | ? |
| **V1 lesson / migration** | Keep BLE/sensor reference | Check RF range and shared-bus behavior |
| Deciding test | Regression baseline | All-load operation and power transitions |

A separate ESP32-S3, display and power assembly remains a fallback if the exposed pins are insufficient; no exact alternative BOM is selected. Whole-board current and temperature limits remain open for both boards. V1’s 200 mA normal / 400 mA peak at 5 V are whole-device estimates, not controller measurements. Espressif’s radio-module certificates require exact module matching and do not establish development-board compliance.

The RLCD radio implementation differs from v1's external-antenna arrangement. Preserve the antenna keepout and test range through the final wet enclosure. Reflective display readability relies on incident light; night use needs a front-light design, described in [assembly and options](ASSEMBLY_AND_OPTIONS.md). Battery charging limits and display limits may constrain the product more than the MCU rating.

## Storage choice

Use the onboard socket in **one-bit SDMMC** mode, as specified in the [canonical wiring map](../../ESP32-S3-RLCD-4.2.md#verified-wiring). No external SD breakout is required. The optional R7 connection must be checked on the actual PCB before concurrent wind/SD use.

| Criterion | Kingston SDCIT2/8GB | Existing consumer microSD | Separate SD breakout |
| --- | --- | --- | --- |
| **Decision** | **★ Logging candidate** | Initial write/read test | ▼ Outside BOM |
| **Price, EUR net** | €10–20 allowance | Replacement price ? | ?; card extra |
| **EU seller** | [TME][sd-eu] | Exact SKU ? | Exact SKU ? |
| **US seller / stock** | ? / ? | ? / ? | ? / ? |
| Media evidence | Industrial pSLC family | Exact card specification ? | Depends on card |
| Temperature / endurance | Exact suffix sheet needed | ? / ? | Depends on card |
| **Assembly** | **★ Onboard socket** | **★ Onboard socket** | ▼ Additional pins and wiring |
| Deciding test | Power-loss recovery and sustained logging | Vendor smoke test | No benefit on RLCD |

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

[rlcd-eu]: https://www.berrybase.de/es/waveshare-esp32-s3-rlcd-aiot-reflexionsdisplay-dev-board-4-2-zoll-300x400-gpio-i2c-uart-akku
[sd-eu]: https://www.tme.eu/en/details/sdcit2_8gb/memory-cards/kingston-technology/
