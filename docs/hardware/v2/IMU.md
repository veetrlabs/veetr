# Heading and attitude IMU decision

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Supplier register](SOURCING_AND_EVIDENCE.md)

## Decision

Use **Adafruit 4754 BNO085** as the preferred new-build prototype candidate, while retaining the working BNO080 board as a reference. It provides fused nine-axis orientation and fitted STEMMA QT connections at a lower board price than Smart DOF 4 Click. The decisive open issue is reliable operation on ESP32-S3 I²C, not the number of axes.

## Comparison

**★** = best documented fit for the row; **▼** = disadvantage for this v2 design; **?** = not established. Unmarked values are neutral or not directly comparable. Unknown evidence is not a failure.

Prices are **EUR excluding VAT**, unless marked otherwise. See the [supplier register](SOURCING_AND_EVIDENCE.md#price-and-quantity-snapshot) for dated quotes, conversions and stock. “Yes” in a compliance row applies only to the stated board, not the assembled Veetr product.

| Criterion | V1 BNO080-family breakout | Adafruit BNO085 | MikroE Smart DOF 4 Click |
| --- | --- | --- | --- |
| **Decision** | Working reference | **★ Preferred prototype** | ▼ Outside preferred BOM |
| Board | Exact SKU ? | 4754 | MIKROE-6369 |
| **Price, EUR net** | Replacement price ? | **★ €26.85** US equivalent | ▼ €59.15 |
| **EU seller** | ? | [BerryBase][imu-eu] | ? |
| **US seller** | ? | [Adafruit][imu-buy] | ? |
| Manufacturer / original listing | [V1 purchase][imu-v1] | [Adafruit][imu-buy] | [MikroE, Serbia][imu-click] |
| **Listed stock** | ? | EU 100+; US count ? | ? |
| Supply continuity | Exact board revision ? | Product documented since 2020 | Same BNO085 dependency |
| **Quality evidence** | Working v1 integration | Published PCB and guide | Published schematic |
| **Features** | Fused heading, heel, pitch | Nine-axis fusion | Nine-axis fusion; ClickID |
| **Board voltage** | ? | 3–5 V VIN; use 3.3 V QT | 3.3 V |
| **Power, sensor IC** | Report-dependent | ≈35 mW fusion example¹ | Same IC; ≈35 mW example¹ |
| **Operating temperature, IC** | Confirm exact IC | −40…+85 °C | −40…+85 °C |
| **Data interfaces** | I²C used | I²C / UART / SPI | SPI default; I²C configurable |
| **Connections** | Existing wiring | 2× QT; signal pads | mikroBUS |
| **Direct Qwiic / QT** | ? | **★ Yes** | ▼ No |
| I²C address | Verify board | `0x4A` / `0x4B` | Verify jumper configuration |
| I²C pull-ups | Verify board | 10 kΩ | Verify board |
| **Assembly for v2** | Reuse wiring | **★ Direct cable** | ▼ I²C solder configuration |
| **CE / EU DoC — board** | Unknown | Unknown | Unknown |
| **RoHS — board** | Unknown | [**Yes — supplier declaration**](https://botland.store/9dof-imu-sensors/22113-bno085-9-dof-imu-fusion-breakout-3-axis-accelerometer-magnetometer-and-gyroscope-adafruit-4754.html) | Unknown |
| **REACH / FCC — board** | Unknown / Unknown | Unknown / Unknown | Unknown / Unknown |
| **Hardware license** | ? | **★ [CC BY-SA][imu-license]** | ? |
| Host software | Existing Veetr driver | Adafruit library candidate | Click SDK / BNO08x driver |
| **V1 lesson / migration** | Telemetry timing affected freshness | Shared ESP32-S3 I²C test required | Same IC does not resolve I²C warning |
| Deciding test | Reference acquisition timestamps | Bus recovery and installed heading | Demonstrate a carrier advantage |

¹ BNO08x current depends strongly on reports and rates. The [BNO080/085 datasheet in the repository](../../../firmware/include/BNO080_085-Datasheet_v1.16.md) gives, for example, about 35 mW for BNO085 100 Hz fusion under its SPI/rail conditions. This is not a measured QT board current. Log total 3.3 V branch current and startup peaks with the reports Veetr actually uses.

Full-board current, temperature limits and binding supply commitments are unrecorded for all three. Prices compare new boards with known quotes; reuse of the v1 board adds no purchase cost. BerryBase’s separate Adafruit quote is €37.50 including VAT. A raw nine-axis sensor without fusion would add host calibration/fusion work; no such board is shortlisted.

The [production selection](PRODUCTION_SELECTION.md#additional-imu-candidate) records the dated whole-board supplier declaration and the BNO086 alternative, which needs INT/RST connections in addition to Qwiic.

## Critical integration gate

[Adafruit's integration warning][imu-warning] describes I²C protocol/timing difficulties on ESP32-S3. A more expensive breakout using the same BNO085 does not by itself solve this. Test both old and proposed IMUs on the actual shared bus, with the selected GNSS and onboard devices.

Require cold-start detection, protocol identity, report age, calibration persistence/recovery, timeouts and recovery after a stalled device. Four-wire QT carries no dedicated interrupt or reset. If reliable recovery requires extra signals, update the canonical allocation before selecting a final carrier. SPI would also require a revised pin budget; it is not an assumed fallback on the current header.

## Lessons from v1 and placement

The [sensor diagnosis](../../FIRMWARE_SENSOR_DIAGNOSIS.md) identified telemetry gating and blocking reads that can make a functioning sensor appear slow. Compare acquisition timestamps, not only displayed updates. Record heading, heel and pitch under motion, power switching and radio activity; do not infer improved accuracy merely from a new board.

Mount rigidly with a defined axis orientation. Keep the IMU away from magnets, ferrous screws, speaker, battery current loops and switching converters. Repeat heading/calibration tests after final assembly and with LEDs, wind boost, SD and CAN active. NMEA heading can replace local heading only when configured; it does not necessarily supply heel and pitch.

## Supply, license and acceptance

Adafruit's board has published schematics/layout and a [CC Attribution/Share-Alike hardware license](https://github.com/adafruit/Adafruit-BNO08x-PCB). The [host library](https://github.com/adafruit/Adafruit_BNO08x) and embedded sensor-hub firmware are separate licensing objects. Hardware openness does not make the sensor's internal fusion firmware open. Exact-board CE/FCC/REACH evidence and a long-term delivery commitment are not recorded.

Adafruit's product history dates to 2020 and the BNO080/BNO085 family supports software familiarity, but neither establishes future availability. Obtain exact revision and quantity quotes. A final winner requires passing the shared-bus, installed-heading and environmental tests in the [test plan](PROTOTYPE_ORDER.md#test-stages).

Sources: [Adafruit board](https://www.adafruit.com/product/4754), [pinout][imu-pins], [Smart DOF 4 Click][imu-click], [v1 component record](../../COMPONENTS.md#motion-sensor).

[imu-pins]: https://learn.adafruit.com/adafruit-9-dof-orientation-imu-fusion-breakout-bno085/pinouts
[imu-warning]: https://learn.adafruit.com/adafruit-9-dof-orientation-imu-fusion-breakout-bno085/arduino
[imu-click]: https://www.mikroe.com/smart-dof-4-click

[imu-eu]: https://www.berrybase.de/en/adafruit-9-dof-orientation-imu-fusion-breakout-bno085-bno080/
[imu-buy]: https://www.adafruit.com/product/4754
[imu-v1]: https://s.click.aliexpress.com/e/_okDR7nd
[imu-license]: https://github.com/adafruit/Adafruit-BNO08x-PCB
