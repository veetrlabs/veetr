# Choosing GNSS for Veetr Vane v2

[Hardware decisions](../../RLCD_V2_HARDWARE.md) · [V2 specification](../../ESP32-S3-RLCD-4.2.md) · [Supplier register](SOURCING_AND_EVIDENCE.md)

**SparkFun MAX-M10S Qwiic leads on integration; Waveshare LC76G is the lower-cost challenger.** V2 needs GNSS on I²C to free two pins for NMEA2000. SparkFun fits the chosen cable system directly. LC76G costs less but needs a different harness and driver. Keep the working v1 board for comparison.

## Board comparison

**★** = best documented fit for that row; ties are possible. **▼** = disadvantage for this v2 design. Unmarked values are neutral or not directly comparable. **?** = not established. Markers assess the stated criterion, not overall product quality; an unknown is not a loss.

Prices are **EUR excluding VAT**, reviewed **2026-11-17**. Conversion and measurement notes follow the table.

| Criterion | V1 Realpoy NEO-8M | SparkFun MAX-M10S | Waveshare LC76G | MikroE GNSS MAX Click |
| --- | --- | --- | --- | --- |
| **Decision** | Working reference | **★ Preferred prototype** | **★ Cost challenger** | ▼ Outside preferred BOM |
| Board / receiver | Selected NEO-8M variant¹ | GPS-18037 / MAX-M10S | WAV579 / LC76G AB² | MIKROE-4643 / MAX-M10S |
| **Price, EUR net** | **★ €8.22** estimate¹ | €41.81 | €15.56 | ▼ €49.14 |
| **EU seller** | ? | [Botland, PL][buy-sparkfun-eu] | [RPishop, CZ][buy-lc76g-eu] | [DigiKey EU][buy-click-eu] |
| **US seller** | ? | [SparkFun][gnss-sparkfun] | ? | ? |
| Manufacturer / original listing | [Realpoy / AliExpress][buy-v1] | [SparkFun][gnss-sparkfun] | [Waveshare][buy-lc76g-direct] | [MikroE, Serbia][gnss-click] |
| **Listed stock** | 8,855 claimed¹ | Count / dispatch unclear | 5+ | ? |
| Supply continuity | Revision control unclear | Module production status documented | No lifecycle commitment found | Same receiver supplier as SparkFun |
| **Quality evidence** | Working v1 integration | Published design + hookup guide | Named module + vendor documentation | Published schematic + module docs |
| **Features** | Position, SOG, COG, time | Multi-GNSS; u-blox messages | Multi-GNSS; EPO/EASY assistance | Same receiver as SparkFun |
| Update rate | 1 Hz baseline; maximum ? | Configuration-dependent | Up to 10 Hz, AB² | Configuration-dependent |
| **Board voltage** | ? | 3.3 V | 3.3 / 5 V | 3.3 V |
| Host logic | Verify actual board | 3.3 V | Verify I/O / pull-ups | 3.3 V |
| **Tracking current, module³** | ? | 11.8 mA | 32.9 mA, AB | 11.8 mA |
| Startup / peak, module³ | ? | Allow 100 mA startup | 58 mA example peak | Allow 100 mA startup |
| **Operating temperature, module** | ? | −40…+85 °C | −40…+85 °C | −40…+85 °C |
| **Data interfaces** | UART used | I²C / UART | I²C / UART | I²C / UART |
| **Board connections** | 4-pin header, micro-USB, SMA¹ | 2× Qwiic, 2.54 mm pads, SMA | 8-pin MX1.25 harness | mikroBUS, SMA |
| **Direct Qwiic / QT** | ▼ No | **★ Yes** | ▼ No | ▼ No |
| I²C address / protocol | ? | `0x42` / u-blox | `0x50`, `0x54` / Quectel | `0x42` / u-blox |
| Auxiliary signals | ? | PPS / reset pads | PPS; remaining pinout to check | See Click pinout |
| Antenna | Underside patch; external option¹ | External SMA; separate cost | Confirm supplied antenna | External SMA; confirm contents |
| **Assembly for v2** | Existing UART wiring | **★ Direct cable; no header soldering** | ▼ Prepared harness | ▼ mikroBUS carrier / adapter |
| **CE / RED evidence⁴** | ? | [MAX-M10 module DoC][gnss-doc] | ? | [MAX-M10 module DoC][gnss-doc] |
| **RoHS evidence⁴** | ? | MAX-M10 module DoC | ? | MAX-M10 module DoC |
| **REACH / FCC evidence⁴** | ? / ? | ? / ? | ? / ? | ? / ? |
| **Hardware license** | ? | **★ [CC BY-SA 4.0][sparkfun-license]** | ? | ? |
| Host software | Existing Veetr UART parser | [SparkFun library][sparkfun-library] candidate | Vendor examples; new driver | Click SDK or u-blox driver |
| **V1 lesson / migration** | Preserve fix validity and drift handling | Frees CAN pins; direct cable | Lower price; more integration work | Higher price; no QT benefit |
| Deciding test | Reference logs / power | Shared I²C reliability | I²C + full installed cost | Carrier / sourcing advantage |

### Basis and shared unknowns

1. **V1 identity and price:** Realpoy's selected “NEO-8M” variant in its combined GY-NEO6MV2 / GY-NEO7MV2 / GY-NEO8MV2 listing. The 2026-11-17 procurement record shows CZK242.62 including VAT (€9.95), 8,855 available and the pictured connectors/patch. Net price assumes 21% VAT. Exact silicon, firmware, board revision and USB function still need checking.
2. **LC76G variant:** confirm AB on delivery. Quectel's PA/PB power and update-rate figures differ; they cannot be substituted for AB figures.
3. **Current:** MAX-M10S is a combined VCC + V_IO example at 3.0 V, 1 Hz, GPS/Galileo/BeiDou B1I; LC76G AB is a 3.3 V vendor example. These are different test conditions. Breakout circuitry and active antenna add load. No current winner is assigned until measured under the same conditions. Sources: [MAX-M10S R08][m10-data], [LC76G v1.3][lc76g-data].
4. **Declarations:** module evidence covers the identified module/configuration, not automatically its breakout or Veetr. Exact-board CE/REACH/FCC evidence remains unrecorded for all four. Receive-only GNSS does not imply a transmitter modular FCC grant is needed.

No controlled Veetr accuracy comparison, complete-board current measurements, complete-board temperature qualification or binding multiyear board-supply commitment is recorded for this set. Obtain quantity quotes for 10/100/500 units. Stock listings are snapshots. Host-library licenses must be captured with the selected versions; receiver firmware is vendor-supplied.

[ECB rates, 2026-11-17][ecb-rates]: **€1 = US$1.0989 = CZK24.387**. Original prices: Realpoy CZK242.62 gross; SparkFun US$45.95 net; RPishop CZK379.34 net; MikroE US$54 net. Compare board prices before shipping, import/handling, antenna and assembly costs. The [supplier register](SOURCING_AND_EVIDENCE.md) retains purchasing details.

## What other marine projects use

These project references add useful alternatives and integration lessons. They describe different products: a receiver on a custom AIS PCB, a Raspberry Pi HAT and a DIY display. Their choices are not interchangeable QT breakouts or evidence of a marine accuracy ranking.

| Criterion | MAIANA AIS | Hat Labs HALPI2 / HaLOS | Open Boat Projects OBP60 V1 |
| --- | --- | --- | --- |
| **GNSS choice** | **Quectel L76L-M33** | **Waveshare MAX-M8Q GNSS HAT** | **NEO-6M** with internal mini antenna |
| Evidence type | Receiver specified by project author | Supported receiver family + HAT sold by project vendor | Receiver listed in design documentation |
| **Primary source** | [MAIANA hardware description][marine-maiana] | [HALPI2 GNSS guide][marine-hatlabs] | [OBP60 design][marine-obp60] |
| Physical integration | Module on custom AIS PCB; ceramic chip antenna | Raspberry Pi HAT; UART connection | Separate GPS module in display/carrier |
| **Buy / price** | No standalone compatible breakout selected | [Hat Labs EU store][marine-hat-shop]: €50.07 incl. displayed tax; net quote needed | Exact breakout/vendor not specified |
| Stock | Standalone module order not assessed | Store shows sold-out and add-to-cart states; confirm | ? |
| Direct QT replacement | ▼ No ready-made QT board identified | ▼ Pi form factor; UART in cited integration | ▼ UART design; exact breakout unknown |
| Lesson for Veetr | Antenna/enclosure integration matters as much as receiver name | Restore configuration at boot; validate update rate and marine dynamic model | Low-cost receiver families are used in open instrument designs |
| Next step | Find an exact EU breakout only if it improves cost/integration | Consider as architecture reference; not preferred for scarce RLCD UART pins | Keep v1-family baseline; do not infer our Realpoy board is identical |

MAIANA documents an integrated receiver/antenna design. Its author also discusses antenna detuning in [GNSS improvements][marine-maiana-tuning]. That supports testing the finished enclosure; it does not transfer a performance result to another L76-family board. **L76L-M33 is not LC76G.**

Hat Labs documents UART configuration at 115200 baud, 10 Hz and a sea dynamic model for supported u-blox receivers, reapplied at boot because backup settings can be lost. That is a useful firmware test case for Veetr, subject to the selected receiver's supported configuration. The store's tax-inclusive HAT price is kept separate from the four net breakout prices above.

OBP60's published design lists NEO-6M. A separate Open Boat Projects [battery anchor-alarm design][marine-anchor] lists NEO-6M, NEO-M8N and ATGM336H as options. These are documented choices, not proof of which exact modules were fitted in every built unit.

## What decides the winner

For the selected carrier, SparkFun's advantage is direct Qwiic assembly and a documented I²C path. LC76G deserves an A/B trial because it is much cheaper. MikroE uses the same MAX-M10S receiver while adding price and a different carrier interface. Price alone does not establish navigation accuracy.

MAX-M10S uses the u-blox host protocol. LC76G uses command/data addresses `0x50` / `0x54` and sequencing described in the [Quectel I²C application note][lc76g-i2c], including 10 ms waits. Implement bounded servicing so GNSS work cannot stall the IMU.

Compare v1 and candidates at the same update rate, antenna exposure and route: cold/warm start, low-speed SOG/COG stability, fix loss/recovery, current and data age. Repeat with IMU, display, SD and radios active. Keep the [v1 stationary-drift and validity handling](../../FIRMWARE_SENSOR_DIAGNOSIS.md). An appropriate reference is needed to assess absolute accuracy.

Promote LC76G if it meets those requirements and its installed cost remains lower after harness and driver work. If shared I²C fails, retain UART and revisit the CAN/controller arrangement before carrier layout. The [canonical specification](../../ESP32-S3-RLCD-4.2.md) owns the final allocation.

[gnss-click]: https://www.mikroe.com/gnss-max-click
[gnss-doc]: https://content.u-blox.com/sites/default/files/documents/MAX-M10_RED_Conformity_UBX-22013367.pdf
[gnss-sparkfun]: https://www.sparkfun.com/sparkfun-gnss-receiver-breakout-max-m10s-qwiic.html
[gnss-guide]: https://docs.sparkfun.com/SparkFun_u-blox_MAX-M10S/hardware_overview/

[buy-v1]: https://s.click.aliexpress.com/e/_onLOZmT
[buy-sparkfun-eu]: https://botland.store/gps-modules/22065-gnss-max-m10s-module-qwiic-sparkfun-gps-18037.html
[buy-lc76g-eu]: https://rpishop.cz/498293/waveshare-lc76g-multi-gnss-modul/
[buy-lc76g-direct]: https://www.waveshare.com/product/ai/lc76g-gnss-module.htm
[buy-click-eu]: https://www.digikey.ie/en/products/detail/mikroelektronika/MIKROE-4643/20840833
[m10-data]: https://content.u-blox.com/sites/default/files/MAX-M10S_DataSheet_UBX-20035208.pdf
[lc76g-data]: https://www.quectel.com/content/uploads/2023/05/Quectel_LC76G_Series_Hardware_Design_V1.3.pdf
[sparkfun-license]: https://github.com/sparkfun/SparkFun_u-blox_MAX-M10S/blob/main/LICENSE.md
[sparkfun-library]: https://github.com/sparkfun/SparkFun_u-blox_GNSS_v3

[ecb-rates]: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html

[marine-maiana]: https://github.com/peterantypas/maiana#electrical
[marine-maiana-tuning]: https://github.com/peterantypas/maiana/discussions/82
[marine-hatlabs]: https://docs.hatlabs.fi/halpi2/user-guide/interfaces/#gnss-gps
[marine-hat-shop]: https://shop.hatlabs.fi/products/max-m8q-gnss-hat
[marine-obp60]: https://open-boat-projects.org/en/diy-multifunktionsdisplay-obp-60/
[marine-anchor]: https://open-boat-projects.org/de/gps-ankeralarm-mit-epaper-display-fuer-akkubetrieb/
[lc76g-i2c]: https://www.quectel.com/content/uploads/2024/02/Quectel_LC26GABLC76G_Series_I2C_Application_Note_V1.0.pdf
