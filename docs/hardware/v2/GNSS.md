# GNSS decision

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Supplier register](SOURCING_AND_EVIDENCE.md)

## Decision

**SparkFun GPS-18037 MAX-M10S Qwiic** is the preferred prototype GNSS. Its fitted Qwiic connectors avoid a custom adapter, and its documented I²C interface frees the MCU pins needed for CAN. **Waveshare LC76G** is a worthwhile low-cost comparison unit, but has a different connector and host protocol. It has not replaced the baseline selection.

The v1 reference is the **Realpoy NEO-8M breakout**, selected as “NEO-8M” in the seller's combined GY-NEO6MV2 / GY-NEO7MV2 / GY-NEO8MV2 listing. The v1 procurement record identifies the board shown with a four-pin header, micro-USB port, SMA connector and underside patch antenna. Its exact receiver silicon/firmware and board revision still need recording; the seller's variant name alone does not establish those. Existing UART support is the regression baseline.

## Board comparison

Reviewed **2026-11-17**. Each column represents a complete board; rows distinguish board specifications, receiver-module specifications and measurements from the Veetr prototype. **Unknown** means the project has no verified value, not that the feature or evidence does not exist. Stock is a dated listing snapshot, not a supplier commitment. Comparison prices are **EUR excluding VAT**, using the [ECB reference rates for 2026-11-17][ecb-rates]: **€1 = US$1.0989 = CZK24.387**. Divide source currency by its rate; round only the final EUR result. V1's displayed VAT-inclusive price is normalized using an **assumed 21% VAT**, pending invoice confirmation. Antennas, shipping, import/handling charges and assembly are excluded unless stated. These are comparison estimates, not landed-cost quotes.

| Criterion | V1 reference: Realpoy NEO-8M | SparkFun GPS-18037 MAX-M10S Qwiic | Waveshare LC76G | MikroE MIKROE-4643 GNSS MAX Click |
| --- | --- | --- | --- | --- |
| **Selection** | Retain as regression baseline | **Preferred prototype** | **Low-cost challenger** | Socket-based alternative |
| Exact identity | Realpoy listing, selected **NEO-8M** variant (GY-NEO8MV2 listing family); exact IC/firmware/revision unverified | GPS-18037 breakout with u-blox MAX-M10S | Waveshare LC76G board; RPishop WAV579; confirm delivered **AB** variant | MIKROE-4643 with u-blox MAX-M10S |
| **EU purchase link** | No traceable EU equivalent established for the tested board | [Botland, Poland][buy-sparkfun-eu] | [RPishop, Czechia][buy-lc76g-eu] | [DigiKey EU listing][buy-click-eu]; regional fulfillment/dispatch to confirm |
| **US purchase link** | US distributor for this Realpoy board not verified | [SparkFun, US][gnss-sparkfun] | US distributor not verified; [Waveshare direct][buy-lc76g-direct] is a manufacturer route, not evidence of US stock | US stock not verified; [MikroE direct][gnss-click] ships from a manufacturer based in Serbia, outside the EU/US |
| Original / manufacturer purchase reference | [V1 recorded marketplace link][buy-v1]; listing does not establish exact delivered revision | [SparkFun][gnss-sparkfun] | [Waveshare][buy-lc76g-direct] | [MikroE][gnss-click] |
| **Unit price** | **€8.22 estimated net**; screenshot price **€9.95 incl. VAT**; €0 incremental if reused | **€41.81 net equivalent**; EU distributor quote pending | **€15.56 net equivalent** at RPishop | **€49.14 net equivalent**, manufacturer direct |
| Original quoted price / tax basis | CZK242.62 including VAT, Realpoy sale listing captured 2026-11-17; import charges separately indicated | US$45.95 before destination taxes | CZK379.34 excluding VAT | US$54 before destination taxes |
| **Amount available** | Seller displays **8,855 available** for selected NEO-8M, 2026-11-17; unverified marketplace stock claim | Exact count unknown; manufacturer page contains in-stock and backorder controls; confirm dispatch. Botland count unverified | RPishop displays **5+ units** | Exact stock count/dispatch unverified; obtain distributor quote |
| Quantity pricing | Unknown | 10/100/500-unit quote required | 10/100/500-unit quote required | 10/100/500-unit quote required |
| Long-term supply | Seller stock claim is not a lifecycle commitment; board revisions and silicon provenance need control | MAX-M10S production status documented by module variant; no complete-board supply commitment | Current EU listing supports a small trial; no board lifecycle commitment established | Same MAX-M10S dependency as SparkFun; separate breakout supplier, no board supply commitment |
| **Quality / traceability evidence** | Realpoy seller/variant identified; used in Veetr. Silicon provenance and controlled accuracy/reliability results unrecorded | Named board, published schematic/layout and integration guide; marine performance untested | Named board and Quectel module documentation; marine performance untested | Named board, schematic and module documentation; no demonstrated navigation advantage over SparkFun |
| **Navigation features** | Position, SOG, COG, time and signal status used by current firmware | Multi-constellation position, velocity and time; configurable u-blox messages | Multi-constellation position, velocity and time; EPO/EASY assistance documented by vendor | Same receiver family as SparkFun; board/interface differences do not establish higher accuracy |
| Update-rate evidence | Current firmware baseline typically 1 Hz; exact receiver capability unverified | Rate depends on constellation/module configuration; freeze intended configuration before comparison | AB supports up to 10 Hz; PA/PB specifications differ | Same configuration-dependent module limits as SparkFun |
| Accuracy demonstrated in Veetr | No controlled absolute-accuracy result recorded | Not measured | Not measured | Not measured |
| **Board supply voltage** | Verify actual breakout input; do not infer it from receiver-family name | **3.3 V** | Advertised **3.3 V / 5 V** board input; verify actual revision | **3.3 V** |
| MCU logic compatibility | Existing UART integration; verify actual signal levels before rewiring | 3.3 V bus | Confirm 3.3 V I/O and pull-up arrangement; a 5 V supply option does not establish 5 V-safe logic | 3.3 V host interface |
| **Typical tracking current** | Not measured separately | MAX-M10S example: **11.8 mA (0.0118 A)** combined VCC + V_IO at 3.0 V, 1 Hz, GPS/Galileo/BeiDou B1I; breakout/antenna extra [M10 datasheet][m10-data] | LC76G AB example: **32.9 mA (0.0329 A)** at 3.3 V under vendor tracking conditions; breakout/antenna extra [LC76G hardware design][lc76g-data] | Same **11.8 mA module example** as SparkFun; complete Click board draw is unmeasured [M10 datasheet][m10-data] |
| Startup / peak current | Unknown | Module supply must accommodate **100 mA (0.100 A)** startup; board/antenna margin additional | AB module peak example **58 mA (0.058 A)**; complete-board startup must be measured | Same module startup requirement; full board/antenna peak unmeasured |
| Whole-board current in Veetr | Unknown; whole-device v1 estimates are not GNSS current | Pending measurement at actual rates and antenna load | Pending measurement at actual rates and antenna load | Pending measurement at actual rates and antenna load |
| **Operating temperature — receiver** | Unknown until module identified | MAX-M10S **−40…+85 °C** | LC76G **−40…+85 °C** | MAX-M10S **−40…+85 °C** |
| Operating temperature — complete board | Not established | Not established for complete breakout including backup battery | Not established for complete breakout | Not established for complete Click board |
| **Communication options** | UART used by Veetr; other interfaces depend on actual board | I²C and UART; no SPI | I²C and UART | I²C and UART |
| **Physical connectors** | Four-pin UART/power header, micro-USB and SMA visible in v1 listing; patch antenna underneath; verify USB electrical function | Two fitted Qwiic ports; 2.54 mm through-hole pads; SMA antenna connector | 8-pin MX1.25 harness; verify antenna arrangement/package | mikroBUS headers and SMA antenna connector |
| Direct Qwiic / STEMMA QT | **No fitted QT connector** on the identified board | **Yes**, 3.3 V four-wire cable | **No**; prepared harness/carrier connection needed | **No**; mikroBUS carrier or adapter needed |
| I²C interface | Not established for tested board | Default `0x42`, u-blox host protocol | `0x50` / `0x54` command/data interfaces, Quectel timing requirements | Default `0x42`, u-blox host protocol |
| PPS / auxiliary signals | Availability unrecorded | PPS/reset available outside four-wire QT connection | PPS exposed; verify other signals against board pinout | Consult Click pinout for auxiliary signals; outside standard QT connection |
| Antenna / added BOM | Underside patch visible; separate antenna variants also sold. Record the actual v1 external antenna and bias requirements | External compatible SMA antenna required; price separate | Confirm antenna and harness contents with RPishop; do not assume all vendor packages match | Compatible SMA antenna required; confirm package and price |
| Soldering / carrier work | Existing working assembly; record footprint | QT connection needs no header soldering; board still needs retention | Prepared cable or carrier connector; extra assembly work to cost | Socketable carrier required; lacks direct QT connection |
| **EU CE / RED evidence** | No verified exact-board/module declaration attached to tested unit | [u-blox MAX-M10 declaration][gnss-doc] covers module/configuration; exact SparkFun board declaration not established | Exact module/board declaration not established in project evidence | Same [u-blox module declaration][gnss-doc]; exact Click board declaration not established |
| **RoHS evidence** | Exact-board evidence not recorded | MAX-M10 declaration includes RoHS; completed breakout evidence to confirm | Exact-board declaration to obtain | MAX-M10 declaration includes RoHS; completed Click evidence to confirm |
| **REACH evidence** | Not recorded | Exact-board supplier declaration to obtain | Exact-board supplier declaration to obtain | Exact-board supplier declaration to obtain |
| **US FCC evidence** | Exact tested configuration evidence not recorded | Exact-board US conformity evidence not established | Exact-board US conformity evidence not established | Exact-board US conformity evidence not established |
| **Hardware design license** | Unknown for tested breakout | [CC BY-SA 4.0 hardware files][sparkfun-license] | Reusable hardware-design license not established | Reusable hardware-design license not established |
| Host software / receiver firmware license | Current Veetr UART integration; exact receiver firmware provenance unrecorded | [SparkFun GNSS library][sparkfun-library] candidate; freeze version/license before integration. Receiver firmware vendor-supplied | Vendor examples/protocol available; review selected code license. Receiver firmware vendor-supplied | Review exact Click SDK/license before reuse; receiver firmware vendor-supplied |
| **V1 lesson / migration consequence** | Preserve working parsing, fix validity and stationary-drift handling; UART occupies the proposed CAN pins on RLCD | I²C frees CAN pins and avoids adapters; must prove shared-bus timing and recovery | Lower board price merits testing; new host protocol/harness and measured power may offset savings | Familiar module but different carrier and higher board price; no demonstrated measurement benefit |
| Qualification needed to win | Identify exact board; capture reference logs and current | Shared-bus stress, GNSS behavior, power, antenna and sourcing gates | Same performance gates plus harness/driver validation and installed-cost comparison | Demonstrate a carrier/sourcing benefit sufficient to change the selected interconnect |

The current examples are **module figures under different test conditions**, not a measured power comparison of the four complete boards. Include regulator, indicators, backup circuitry and active antenna consumption, and compare all candidates at the same update rate and reception conditions.

Module declarations do not certify a third-party breakout or Veetr. “FCC evidence not established” does not imply that a receive-only GNSS board should have a transmitter modular grant; applicable US requirements and evidence must be assessed for the actual product.

The [u-blox datasheet](https://content.u-blox.com/sites/default/files/MAX-M10S_DataSheet_UBX-20035208.pdf), R08, distinguishes receiver supply and I/O currents. Do not turn a low-power marketing figure into a whole-board battery estimate. Compare measured power at the same update rate, satellite configuration, antenna arrangement and fix quality.

The [Quectel LC76G hardware design](https://www.quectel.com/content/uploads/2023/05/Quectel_LC76G_Series_Hardware_Design_V1.3.pdf), v1.3, distinguishes AB, PA and PB: AB supports up to 10 Hz, while PA/PB figures and power modes differ. The lower current of another LC76G variant cannot be attributed to the Waveshare AB board. Confirm the delivered module marking.

## Why the price gap does not decide the result

On the normalized net basis, the v1 Realpoy board is approximately **€8.22**, LC76G **€15.56**, SparkFun MAX-M10S **€41.81**, and GNSS MAX Click **€49.14**. V1's net value depends on the stated VAT assumption. Accessory contents differ; connector preparation, driver work, antenna arrangement and measured power matter to the assembled instrument. There is no project evidence that the more expensive receiver is inherently more accurate on a boat.

MAX-M10S has an available module-level RED/RoHS declaration and documented binary protocol/library support. Those are integration advantages, not certification of the SparkFun board or Veetr. MikroE's use of the same receiver offers no demonstrated navigation advantage sufficient to justify changing the chosen interconnect.

## I²C integration and acceptance

MAX-M10S uses the u-blox host interface. LC76G uses command/data addresses `0x50` and `0x54` and timing sequences documented in the [Quectel I²C application note](https://www.quectel.com/content/uploads/2024/02/Quectel_LC26GABLC76G_Series_I2C_Application_Note_V1.0.pdf), including 10 ms waits. A synchronous implementation must not stall IMU servicing. Neither board is a drop-in firmware replacement for the current UART receiver.

Test each candidate with the same antenna exposure and motion route: cold/warm starts, low-speed SOG/COG stability, loss/reacquisition, fix validity and actual update age. Include IMU, display, logging, BLE and Wi-Fi workload. Test power recovery and bounded I²C transactions. Absolute accuracy needs an appropriate reference; comparing two disagreeing receivers alone cannot establish it. Preserve stationary-drift handling from the [firmware diagnosis](../../FIRMWARE_SENSOR_DIAGNOSIS.md).

Promote LC76G only if its full installed cost saving survives connector preparation and it meets the same acquisition, freshness, runtime and sourcing requirements. If neither works reliably on the shared bus, retain UART and redesign the CAN/controller arrangement before carrier layout.

## License, supply and evidence

SparkFun publishes [hardware files and license](https://github.com/sparkfun/SparkFun_u-blox_MAX-M10S/blob/main/LICENSE.md) under CC BY-SA 4.0 for hardware; individual code licenses remain separate. Its [GNSS v3 host library](https://github.com/sparkfun/SparkFun_u-blox_GNSS_v3) is a candidate dependency, not an integration already selected in Veetr. Receiver firmware is vendor-supplied. A redistributable hardware-design license for the Waveshare or Click board has not been established here.

The MAX-M10S R08 datasheet lists production status by exact module variant. Two breakout vendors still share one receiver supplier. None of these complete boards has a recorded binding multiyear supply promise to Veetr. The comparison above includes GNSS procurement and conformity evidence; the [supplier register](SOURCING_AND_EVIDENCE.md) collects the cross-system BOM. Update both records when a supplier quote changes the selection.

Sources: [SparkFun board][gnss-sparkfun], [electrical/connector guide][gnss-guide], [MikroE board][gnss-click], [u-blox declaration][gnss-doc], [Waveshare LC76G documentation](https://www.waveshare.com/wiki/LC76G_GNSS_Module), [RPishop listing](https://rpishop.cz/498293/waveshare-lc76g-multi-gnss-modul/).

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
