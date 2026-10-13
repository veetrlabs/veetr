# RLCD v2 hardware: verified wiring and module shortlist

Evidence reviewed: **2026-10-13**. Status: **engineering proposal, not a validated carrier design or purchasing release**. Keep the existing [RLCD firmware pins](../firmware/include/board/pins_esp32s3_rlcd.h) and [sensor wiring](RLCD_TO_SENSORS.md) until the relevant hardware tests pass. The original ESP32 target is unchanged.

## Decision

Keep the Waveshare ESP32-S3-RLCD-4.2 and its display, radio, SD socket, battery circuit, and USB. Retain wind RS485 and the working BNO08x IMU. Prototype a MAX-M10S GNSS board over I²C, freeing GPIO43/44 for the ESP32-S3's CAN controller and an isolated transceiver. This preserves the required functions in the proposed pin budget, but **GNSS-over-I²C, NMEA2000 read/write and SD logging are not implemented by this documentation update**. Wi-Fi remains a hardware capability to integrate and validate alongside BLE.

No researched board combination yet demonstrates all of: confirmed production quantities, long-term availability, complete regulatory evidence, low cost, and zero module rework. The tables below identify useful candidates and the specific reasons they are conditional. Do not freeze the carrier PCB from a retailer description alone.

## Direct verification of Waveshare SD and header wiring

The earlier proposed CMD=38 / CLK=21 mapping is reversed. The verified mapping is:

| SD1 signal | Schematic net | ESP32 GPIO | Evidence |
| --- | --- | --- | --- |
| Pin 3 CMD | MOSI | **21** | Schematic SD-CARD block and example constructor |
| Pin 5 CLK | SCK | **38** | Same two independent sources |
| Pin 7 D0 | MISO | **39** | Same two independent sources |
| Pin 2 DAT3 / SPI CS | SDCS | **17 only through R7** | R7 is marked **NC**, not populated in the documented design |
| DAT1 / DAT2 | No MCU connection | None | One-bit design |
| GPIO3 | Expansion P1-11 | **Not SD** | Direct header connection, no SDCS assignment |

The [official schematic][ws-sch] was inspected visually, including SD-CARD, U1 and P1; its downloaded SHA-256 was `63e679d106253ac6ce8c4eaa69610f34f879660f372953f15e259fc2a7dac1aa`. Waveshare can replace that URL without changing its name; compare the purchased PCB revision.

The [official Arduino header][ws-sdh], at vendor commit `eb1f63427d735a22b9c30e22fa63ebddae1834d3`, declares `CustomSDPort(..., int clk = 38, int cmd = 21, int d0 = 39, int width = 1)`. Its [implementation][ws-sdc] assigns these parameters to `slot_config` and calls `esp_vfs_fat_sdmmc_mount`. The [06_SD_Card sketch][ws-demo] constructs the default port and performs file write/read operations. The [vendor walkthrough][ws-arduino] agrees that it uses SDMMC.

Thus SD does not need GPIO3 or a driven CS in this mode. R7's schematic NC marking is not a continuity measurement on the user's board. Before using SD and RS485 together, inspect R7 and check the GPIO17-to-DAT3 path unpowered. If fitted, stop and resolve the board variant; GPIO17 toggling can interfere with SD startup even when the intended transport is SDMMC. Do not silently relocate RS485 TX or fit/remove R7 in software documentation.

GPIO3 is a **JTAG-selection strapping pin**, not the BOOT-mode strap. Check reset-time bias and external DE/RE loading against the [ESP32-S3 datasheet][s3-data]. Its use as DE/RE after reset is separate from its strap function.

### Verified P1 header and proposed allocation

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

**Do not connect CAN and the existing UART GNSS simultaneously to GPIO43/44.** The GNSS conversion must first pass regression tests and be selected explicitly in a future v2 firmware profile. An unmodified v1/RLCD image must never be flashed onto that rewired carrier: it still emits GNSS UART traffic on these pins. Include a hardware CAN-disable provision, default recessive TXD, and boot-ROM UART43 behavior in the carrier review; software startup alone cannot prevent reset-time CAN disturbance.

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

### GNSS and IMU bus feasibility

MAX-M10S has an I²C interface (normally `0x42`); current IMU addresses `0x4A/0x4B`, RTC `0x51`, and SHTC3 `0x70` do not conflict. Also inventory the onboard audio codecs and every module's pull-ups. Address compatibility alone does not establish timing reliability. See [SparkFun's hookup guide][gnss-guide] and [Adafruit's BNO085 warning][imu-warning]. Keep all pull-ups at 3.3 V and verify their parallel resistance and edge timing.

The current firmware initializes UART GNSS and a 400 kHz shared I²C bus. Preserve the working BNO080 implementation; replacing the board with a BNO085 is not an automatic software qualification. Adafruit reports BNO085 I²C timing/clock-stretching problems on ESP32-S3. The existing [sensor latency investigation](FIRMWARE_SENSOR_DIAGNOSIS.md) also found software scheduling bottlenecks, so do not attribute all latency to hardware.

Prototype with bounded GNSS reads, limited output sentences/UBX messages, IMU report-age measurements, bus timeouts and recovery. Measure at the required GNSS/IMU rates with display, SD, CAN and both radios active. An I²C scan is not an acceptance test. If the shared bus fails, revisit the architecture before routing: retain UART GNSS and consider an external CAN controller/bridge or a controller board with more exposed pins. Do not consume USB, BOOT, or display pins as an undocumented fallback.

## Ready-made module shortlist

Prices and stock below are observations from retrieved distributor pages, sometimes cached and contradictory, not quotes. EU-based sellers (TME Poland, Botland Poland, BerryBase Germany, and Olimex direct in Bulgaria) are preferred. Mouser/DigiKey regional storefronts are alternatives serving the EU; an EU website does not prove EU warehouse stock or shipment origin. No purchases were made.

| Function / rank | Exact candidate and EU sourcing | Fit, assembly and evidence | Limitation / disposition |
| --- | --- | --- | --- |
| Controller/display: retain | Waveshare ESP32-S3-RLCD-4.2, BerryBase **WS-33298** ([listing][rlcd-eu]) | Existing platform; P1 socket, onboard display/SD/battery; Espressif publishes WROOM-1 CE/FCC records [certificates][esp-cert] | No signed whole-RLCD-board DoC reviewed. No board/panel longevity or production-stock commitment found. Request exact PCB version and batch quote |
| GNSS: socket preference | MIKROE **MIKROE-4643 GNSS MAX Click**, MAX-M10S; [TME listing][gnss-tme], [Mouser EU][gnss-mouser] | 3.3 V, I²C/UART, mikroBUS headers, external SMA antenna. [Manufacturer][gnss-click]; u-blox has a module-level [RED DoC][gnss-doc] | Mouser snapshot: €46.44, 9 stock, 26 on order with an already-past ETA; not confirmed availability. GNSS antenna extra. Board-level CE/FCC evidence not established |
| GNSS: compact alternative | SparkFun **GPS-18037 MAX-M10S Qwiic**, [Botland][gnss-botland] | Solderless Qwiic plus mounting holes; same GNSS IC/module family, [source][gnss-sparkfun] | Header pins may require assembly; Qwiic cables need retention. Not a second semiconductor source. EU price/stock not reliably extracted; obtain quote |
| IMU: retain existing, replacement candidate | Adafruit **4754 BNO085**, BerryBase **ADA4754** ([listing][imu-eu]) | Tested assembled breakout, STEMMA QT connectors; 9-axis fused orientation, [pinout][imu-pins] | €27.45 incl. VAT. English page says 100+ while German page says unavailable: stock unconfirmed. I²C warning above. Whole-board CE/FCC and lifecycle commitment not established |
| CAN: first prototype candidate | Olimex **A20-CAN-ISO**, [EU manufacturer store][olimex-can] | €15.95 ex VAT, listed in stock; assembled board; carrier needs a mating-header adapter. Separate [isolated schematic][olimex-sch] shows TJA1052, isolated DC/DC, 3.3 V logic, 5 V power, normally open termination jumpers. Signed [EU EMC/RoHS DoC][olimex-doc] covers ISO variant | Needs battery-backed 5 V and carrier adapter; confirm supplied revision/connector population, unpowered behavior and startup inhibit. No reviewed FCC/REACH evidence or quantity guarantee |
| CAN: socket alternative, conditional | MIKROE **MIKROE-5785 CAN Isolator 3 Click**, MAX14882; [TME][can-tme] | Integrated isolated supply path and 3.3 V operation, mikroBUS; [manufacturer][can3], [schematic][can3-sch] | €46.38 ex VAT / €55.19 incl. on German listing, **0 TME stock**. Fixed termination needs supplier-prepared removal for a drop node. No reviewed board DoC/FCC evidence; not approved for carrier production |
| CAN: older alternative | MIKROE **MIKROE-2627 CAN Isolator Click**, ADM3053; [TME][can1-tme] | Signal + isolated power, long documented history ([2017 announcement][can1-history]), socket assembly | [Schematic][can1-sch] includes split termination; 5 V power required even with 3.3 V I/O. More power/EMI work; no clear cost or solderless advantage |
| CAN: regulatory evidence / lab reference | TI **ISOW1044DFMEVM**, [TI][can-evm], [Mouser Spain][can-evm-eu] | Ready-made board, isolated DC/DC, 3.3 V-compatible I/O, TI lists a board-specific EU DoC and emission evidence | Evaluation board, not a compact production module. Price/stock and commercial embedding terms require confirmation; [guide][can-evm-guide] uses populated termination resistors, so do not assume jumper-only drop-node conversion |
| CAN: not complete by itself | MIKROE **MIKROE-4809 CAN Isolator 2 Click**, ISO1042 ([manufacturer][can2]) | Cheaper transceiver board, 3.3 V host logic | Requires a separately isolated bus-side supply; **ISO1042 isolation alone does not provide isolated power**. Do not price it as a complete isolated interface |
| Wind RS485: retain, isolated upgrade candidate | MIKROE **MIKROE-3863 RS485 Isolator 2 Click**, ADM2867E; [TME][rs485-tme] | Signal + power isolation, mikroBUS; [manufacturer][rs485] documents half-duplex and direction options | €40.68 ex VAT / €48.82 incl., 0 TME stock. Configure half-duplex and linked DE and /RE; jumpers include solder options, so request factory setup. Not a drop-in untested replacement |
| RS485: lower-cost EU alternative | Olimex **MOD-RS485-ISO**, [manufacturer][olimex-rs] | €16.95 ex VAT, in-stock listing, UEXT cable included; [board EMC/RoHS DoC][olimex-rs-doc], ISO35T and onboard PIC | PIC firmware/protocol and half-duplex **9600 8E1** compatibility need review; do not assume transparent replacement of current converter. Retain existing converter until validated |
| SD: first logging candidate | Kingston **SDCIT2/8GB**, [TME][sd-tme] | Industrial pSLC microSDHC, fits existing socket; [manufacturer][sd-maker] | No extra breakout. Validate FAT, endurance workload, removal/power-loss recovery. Price/quantity quote still required |

### Preferred CAN prototype: Olimex A20-CAN-ISO

The isolated board has its **own repository**; the product page's generic A20-CAN link can lead to the non-isolated design. The reviewed isolated source commit is `ca00943e6385a4c8b9c4c8e3a69489aa078ce446`. Its Rev_B directory contains a drawing whose title block says Rev_A (2016-04-04): confirm the shipped revision rather than guessing from the filename.

The drawing shows TJA1052IT/5Y, F0505S-2WR2 isolated 5 V DC/DC, separate ground domains, and split termination through **CAN_T1/CAN_T2 marked opened**. Keep both open for a drop. This makes it a better first prototype candidate than the fixed-termination Click, subject to verifying actual population. Its 40-pin GPIO3 connector is an Olimex connector name, **not ESP32 GPIO3**: pin 1=5 V, pin 3=3.3 V, pins 2/4=local GND, pin 33=CAN-TX, pin 35=CAN-RX. CAN1 pin 1=isolated ground, 2=CANL, 3=CANH. Confirm which connector footprint is fitted and key the adapter. Do not connect the 40-pin connector directly to Waveshare P1.

Battery operation needs a regulated 5 V rail. A concrete evaluation candidate is [Pololu 4085 / S13V20F5][power], also listed by [Botland][power-eu]: 2.8–22 V input, 5 V output, 0.1-inch header holes. Have headers fitted by the assembler. A carrier fed from P1's switched 3.3 V could boost the modest CAN load only if measured regulator margin permits; do not bypass battery protection or tie converter output to USB VBUS. Its 10–20 mA typical no-load current is a battery penalty and its lack of reverse-voltage protection needs consideration. This is an evaluation option, not a qualified power solution or a direct boat-supply front end.

### CAN Click schematic finding

The CAN Isolator 3 file URL says v100 but its drawing title is **v101**. It shows MAX14882, transformer T1 (TGMR-1464V6LF), rectifier D1/D2 and isolated-ground domain: this is evidence of a complete isolated power path, unlike the ISO1042-only candidate. It also shows **R6 and R7, each 56 Ω, in series across CANH/CANL** (112 Ω DC termination); no termination-disable jumper is shown. JP1 selects supply, JP2 configures the isolated rail, not termination. These R7 references are on the CAN board and unrelated to Waveshare's SD R7.

Consequently, an unmodified CAN Isolator 3 is not the default module for a normal drop on an already terminated NMEA2000 backbone. Ask the supplier for a documented DNP termination variant or a prepared assembly service, then verify resistance and PCB revision. Do not require the user to remove small resistors while calling the result socket-only. This excludes the unmodified Click from the preferred drop-node BOM; the Olimex candidate above avoids that documented fixed-termination issue. Final carrier selection still requires physical validation.

Vendor descriptions call the Click connection “UART”, but MAX14882/ADM3053/ISO1042 are **physical-layer transceivers**, not UART-to-NMEA2000 gateways. Route ESP32-S3 **TWAI TX/RX** to the actual IC TXD/RXD nets, checking the Click's header naming. The [Espressif TWAI documentation][twai] requires an external transceiver. No additional CAN controller is needed for this proposed two-GPIO solution.

## Preliminary BOM and cost comparison

One of each unless stated otherwise. This is a planning BOM, not a claim that all parts are currently orderable or that v2 is cheaper than v1. Keep the existing ultrasonic wind head and its rated power supply until a replacement is qualified.

| Item | Quantity | Budget EUR, excluding VAT/shipping | Basis / additional requirement |
| --- | --- | --- | --- |
| WS-33298 RLCD board | 1 | 30–45 | Engineering allowance; EU listing verified, reliable live price not obtained |
| MIKROE-4643 GNSS | 1 | 46.44 | Distributor snapshot; antenna not included |
| SMA GNSS antenna / cable | 1 | 10–25 | Allowance; choose compatible active/passive antenna and bias specification with GNSS vendor |
| ADA4754 IMU | 1 | 23.07 | €27.45 gross converted at German 19% VAT for comparison; reuse existing IMU when possible |
| Olimex A20-CAN-ISO | 1 | 15.95 | Manufacturer net price; mating connector included in carrier allowance |
| MIKROE-3863 isolated RS485 | 1 | 40.68 | Optional replacement of existing converter; supplier setup not priced |
| SDCIT2/8GB | 1 | 10–20 | Allowance pending quote |
| Compatible documented single-cell battery | 1 | 8–15 | Allowance; exact cell, fit, protection and charging qualification open |
| Carrier PCB, sockets, retention, internal cables | 1 set | 15–35 | Prototype allowance, supplier assembly additional |
| NMEA2000 connector/drop lead, enclosure sealing and protection | 1 set | 25–60 | Allowance; final connector SKU and surge design open |
| Battery-backed 5 V CAN conversion | 1 | 15–25 | Pololu 4085 evaluation allowance pending EU quote and rail tests; wind-head conversion additional if needed |
| **Planning subtotal** | | **239.14–351.14** | Includes isolated RS485; excludes wind head, existing wind power supply, labour, test gear and certification |

Using the existing IMU and RS485 converter reduces that subtotal by €63.75, but preserves the existing converter's isolation limitations. A retained RLCD board is also a sunk cost for the prototype, not for new production. Do not add an external SD breakout or separate Wi-Fi/BLE board. Replacing the CAN Click with Olimex saves €30.43 in board price before accounting for its required 5 V supply. Replacing the RS485 Click with Olimex could save another €23.73 but is not included in the subtotal because protocol compatibility is unverified. Socket GNSS and isolated CAN are the main new functional cost; GNSS alternatives require current quotes before claiming savings.

The repository README's roughly **US$250 (2025)** electronics estimate has different currency, date and scope. There is no verified like-for-like v1 procurement BOM here; therefore the “lower price than v1” objective remains **unproven**. Obtain 10/100/500-unit quotes with VAT, shipping, wind head, antenna, carrier assembly, battery and enclosure treated consistently. Compare an unchanged v1 baseline, a reuse prototype, and a new-build v2. Do not reduce surge protection, isolation or connector retention to hit an unsupported target.

## Power, assembly and sailing reliability

- P1-2 is USB VBUS. A module needing 5 V cannot be assumed to work from battery merely because it works on USB. The preferred Olimex CAN needs 5 V power and 3.3 V logic; CAN3 can use 3.3 V but has the termination limitation above. In either case, the Waveshare regulator's available system margin must be measured with SD writes and RF bursts. Battery-only wind-head power is a separate requirement: retain/identify its voltage and consumption, and qualify a converter if it must run from the local cell. No direct 12/24 V boat supply connection to P1 is permitted by this design.
- Keep local, CAN-isolated and any RS485-isolated ground domains separate. Do not bridge them through USB shields, oscilloscope grounds, mounting hardware or carrier copper. In the first prototype, power Veetr locally; NMEA2000 NET-S is not a Veetr power input. The isolated CAN reference connects to network reference according to the final interface design; shield/drain routing is reviewed separately.
- Use an assembled carrier with keyed connections, socketed boards, standoffs and mechanical retention. Qwiic/STEMMA QT avoids header soldering but is not a waterproof or vibration-certified interconnect. Order fitted headers and jumper/termination configuration from the supplier or carrier assembler. Avoid loose Dupont wiring in the sailing unit.
- Preserve the RF antenna keepout; separate the IMU from the battery, magnets, speaker, high-current paths and switching converters. Check heading with the finished enclosure and all loads operating. GNSS course over ground does not replace magnetic heading at rest.
- Qualify charging temperature limits, cell fit/polarity, overcurrent protection, battery retention, USB/battery switchover, brownout and shutdown behavior. Nominal 3× ADC voltage is not a calibrated state-of-charge measurement. Obtain the cell supplier's safety and transport evidence, including UN38.3 test summary where applicable.
- Provide connector-level ESD/transient protection, reverse-polarity/fusing as appropriate, corrosion-resistant connections, strain relief and condensation management. An isolator's kV rating is not a lightning-survival or waterproof-product rating. Keep sensor/communications failures from freezing the local display; mark stale data explicitly.

## NMEA2000 read/write integration requirements

Target classic CAN at **250 kbit/s, 29-bit identifiers**, using a suitable NMEA2000 stack over TWAI. CAN electrical communication is only the first layer. Implement address claim/NAME, product information, appropriate PGNs/fast-packet handling, validity and units, bus-off recovery, rate limiting, and deterministic source selection so incoming data is not echoed back as new measurements.

Initial scope: receive useful navigation/wind/heading data; transmit only explicitly selected, valid local wind, GNSS and attitude data. Start bench tests receive-only. Enable transmission after address-claim, conflicting-node, unplug/replug and bus-load tests pass. No arbitrary bus-command forwarding or steering control is included in this plan. A second CAN node and two correctly placed end terminators are needed for meaningful normal-mode TX/ACK testing; a software loopback cannot validate isolation or interoperability.

Keep termination at the two backbone ends, not every drop. Follow the current licensed physical/network requirements for cable/drop length, connector wiring, power load and shield treatment. The device must not disturb a live network when unpowered, resetting or running an incompatible firmware image. Follow the [NMEA product certification process][nmea] before making certification or logo claims.

## Regulatory evidence and supply confidence

**Module certificates do not automatically certify the assembled product.** The full Veetr enclosure, carrier, power supply, cables, radio configuration and firmware remain relevant to assessment. See [compliance notes](COMPLIANCE.md).

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| CE / EU Declaration of Conformity | Manufacturer declaration for a specified product and applicable legislation; verify model/revision and signed scope | Universal third-party approval, marine ruggedness, or automatic approval of a host assembly |
| RoHS | Restrictions on specified hazardous substances in electrical/electronic equipment | EMC, RF performance, isolation or reliability certification |
| REACH | Chemical/substance obligations and relevant supplier declarations | A radio approval or substitute for RoHS/CE |
| FCC module authorization | US radio authorization subject to the grant and integration conditions | Blanket host authorization; digital emissions, antenna, RF exposure, labeling and co-location conditions still require review |
| UL/VDE isolator-component evidence | Defined component insulation tests/ratings | Compliance of the Click board, carrier, marine surge performance or assembled Veetr |
| NMEA2000 certification | Separate product/protocol/network assessment by NMEA | CE/FCC or waterproofness |

Sources: [EU manufacturer obligations][eu-ce], [European Commission RoHS][eu-rohs], [ECHA REACH][reach], [FCC module integration guidance][fcc], [NMEA][nmea].

Strongest evidence found: Olimex's **signed A20-CAN/A20-CAN-ISO EMC/RoHS DoC** dated 2021-07-08 and its separate MOD-RS485-ISO DoC; Espressif's WROOM-1 **CE/FCC listings**; u-blox's **MAX-M10 RED/RoHS declaration**, R06 dated 2025-11-26 (with a specified external antenna); TI's **ISOW1044DFMEVM EU DoC listing**. These cover different objects. OSHWA certification concerns open-source hardware, not regulatory compliance. None is a signed DoC for an assembled Veetr, and u-blox's module document does not cover a third-party breakout automatically. No exact-board CE/REACH/FCC evidence was established for the Click candidates or ADA4754 in this review. A retailer's generic “Certificates” heading, US manufacturing origin, or a RoHS badge is not such evidence. Request model-specific documents and check their scope before production selection.

Supply ranking: Olimex's isolated CAN schematic dates to 2016, its [OSHWA record][olimex-oshwa] to 2020, and it remains listed in 2026; this is useful history, not a future supply contract. Its published price tiers of €14.36 at 10+ and €12.76 at 50+ do not prove those quantities are in stock. Espressif publishes an [ESP32-S3 commitment of at least 12 years from 2021-01-01][longevity]; this is not a Waveshare display-board or panel commitment. MIKROE's CAN family has documented predecessors back to 2017 and continued variants, which supports ecosystem continuity but not pin-compatible replacement or guaranteed stocking of a specific Click. MAX-M10S has multiple breakout vendors, but both depend on the same underlying module. BNO080 → BNO085 evolution supports software familiarity, not a future supply guarantee. No binding multiyear supply promises for these complete boards were found.

Before ordering production quantities, obtain written lead times and 10/100/500-unit pricing, exact BOM/PCB revision control, PCN/EOL notice policy, last-time-buy terms, and lifecycle status of the underlying module. Reserve alternate carrier footprints only after electrical and mechanical comparison. Treat zero or conflicting stock snapshots as unresolved, not evidence of discontinuation or sufficient capacity.

## Open verification items and acceptance gates

| Gate | Work and pass evidence | Can be done now? |
| --- | --- | --- |
| Documentation | Schematic and source agree on CLK38/CMD21/D0 39; P1 GPIO3; optional R7/17 | **Done** from official sources |
| Board revision | Photograph revision/R7, unpowered continuity check, correct header orientation and supply rails | Physical RLCD required |
| SD + existing wind | Vendor SD smoke test, then concurrent Modbus/file read-write; repeated cold boots and battery/USB transitions; no sensor regression | Existing board + card + sensors |
| GPIO3 / CAN startup | Scope reset-time strap loading and DE behavior; later GPIO43 boot traffic, transceiver inhibit and recessive bus behavior | Actual module assemblies required |
| I²C feasibility | GNSS+IMU+onboard scan, pull-up/edge checks, report age and bus utilization, recovery after sensor failure under full workload | GNSS candidate and current IMU required |
| CAN physical module | Confirm isolated power, actual termination resistance/DNP variant, logic voltage, current, no DC ground bridge; rated tests by suitable lab | Supplier schematic/config confirmation now; hardware/lab later |
| NMEA2000 RX/TX | Two-node 250 kbit/s extended-frame tests, ACK, address claim, PGNs, bus-off/recovery, real network interoperability | Hardware and firmware implementation required |
| Power / endurance | Worst-case rail/current/temperature measurements with radios+SD+wind+CAN; runtime, charge/discharge and power-loss logging tests | Hardware required |
| Regression | Original target and current RLCD pin definitions unchanged; then field regression of wind, GNSS, IMU, BLE, display before enabling v2 profile | Static check now; functional tests later |
| Procurement / compliance | Signed exact-part evidence, suitable unmodified or factory-configured CAN module, EU stock and lifecycle/quantity quotes, final cost comparison | Supplier/lab follow-up; no approvals assumed |
| Environmental qualification | Enclosed-unit salt/condensation, vibration, ingress, temperature, RF/EMC and cabled transient tests with recorded criteria | Final assembly required |

The next firmware change should introduce an explicit, separately validated v2 profile. This update changes only documentation and misleading comments in the current pin header; no new active SD/CAN/GNSS pin macros or runtime behavior are introduced.

[ws-sch]: https://files.waveshare.com/wiki/ESP32-S3-RLCD-4.2/ESP32-S3-RLCD-4.2-schematic.pdf
[ws-sdh]: https://github.com/waveshareteam/ESP32-S3-RLCD-4.2/blob/eb1f63427d735a22b9c30e22fa63ebddae1834d3/02_Example/Arduino/06_SD_Card/sdcard_bsp.h
[ws-sdc]: https://github.com/waveshareteam/ESP32-S3-RLCD-4.2/blob/eb1f63427d735a22b9c30e22fa63ebddae1834d3/02_Example/Arduino/06_SD_Card/sdcard_bsp.cpp
[ws-demo]: https://github.com/waveshareteam/ESP32-S3-RLCD-4.2/blob/eb1f63427d735a22b9c30e22fa63ebddae1834d3/02_Example/Arduino/06_SD_Card/06_SD_Card.ino
[ws-arduino]: https://docs.waveshare.com/ESP32-S3-RLCD-4.2/Arduino#06_sd_card
[s3-data]: https://documentation.espressif.com/esp32_s3_datasheet_en.pdf
[rlcd-eu]: https://www.berrybase.de/es/waveshare-esp32-s3-rlcd-aiot-reflexionsdisplay-dev-board-4-2-zoll-300x400-gpio-i2c-uart-akku
[esp-cert]: https://www.espressif.com/en/support/documents/certificates
[gnss-click]: https://www.mikroe.com/gnss-max-click
[gnss-tme]: https://www.tme.eu/rs/en/details/mikroe-4643/add-on-boards/mikroe/
[gnss-mouser]: https://eu.mouser.com/en/ProductDetail/Mikroe/MIKROE-4643?qs=rQFj71Wb1eVDhsMv9QMdow%3D%3D
[gnss-doc]: https://content.u-blox.com/sites/default/files/documents/MAX-M10_RED_Conformity_UBX-22013367.pdf
[gnss-sparkfun]: https://www.sparkfun.com/sparkfun-gnss-receiver-breakout-max-m10s-qwiic.html
[gnss-guide]: https://docs.sparkfun.com/SparkFun_u-blox_MAX-M10S/hardware_overview/
[gnss-botland]: https://botland.store/gps-modules/22065-gnss-max-m10s-module-qwiic-sparkfun-gps-18037.html
[imu-eu]: https://www.berrybase.de/en/adafruit-9-dof-orientation-imu-fusion-breakout-bno085-bno080//
[imu-pins]: https://learn.adafruit.com/adafruit-9-dof-orientation-imu-fusion-breakout-bno085/pinouts
[imu-warning]: https://learn.adafruit.com/adafruit-9-dof-orientation-imu-fusion-breakout-bno085/arduino
[can3]: https://www.mikroe.com/can-isolator-3-click
[can3-sch]: https://download.mikroe.com/documents/add-on-boards/click/can-isolator-3-click/can_isolator_3_click_v100_Schematic.PDF
[can-tme]: https://www.tme.eu/de/details/mikroe-5785/erweiterungsboards/mikroe/
[can1-tme]: https://www.tme.com/us/en-us/details/mikroe-2627/add-on-boards/mikroe/can-isolator-click/
[can1-sch]: https://download.mikroe.com/documents/add-on-boards/click/can-isolator/can-isolator-click-schematic.pdf
[can1-history]: https://www.mikroe.com/blog/can-isolator-click-provides-isolated-can-communication
[can2]: https://www.mikroe.com/can-isolator-2-click
[can-evm]: https://www.ti.com/tool/ISOW1044DFMEVM
[can-evm-eu]: https://www.mouser.es/es/ProductDetail/Texas-Instruments/ISOW1044DFMEVM?qs=TuK3vfAjtkU%2FNoFUJrmHuQ%3D%3D
[can-evm-guide]: https://www.ti.com/lit/ug/sllu332/sllu332.pdf
[rs485]: https://www.mikroe.com/rs485-isolator-2-click
[rs485-tme]: https://www.tme.eu/fr/details/mikroe-3863/plaques-d-expansion/mikroe/
[sd-maker]: https://www.kingston.com/en/memory/search?partid=SDCIT2%2F8GB
[sd-tme]: https://www.tme.eu/en/details/sdcit2_8gb/memory-cards/kingston-technology/
[twai]: https://docs.espressif.com/projects/esp-idf/en/v5.4/esp32s3/api-reference/peripherals/twai.html
[nmea]: https://www.nmea.org/nmea-2000.html
[eu-ce]: https://single-market-economy.ec.europa.eu/single-market/goods/ce-marking/manufacturers_en
[eu-rohs]: https://environment.ec.europa.eu/topics/waste-and-recycling/rohs-directive_en
[reach]: https://echa.europa.eu/regulations/reach/understanding-reach
[fcc]: https://apps.fcc.gov/oetcf/kdb/forms/FTSSearchResultPage.cfm?id=44637&switch=P
[longevity]: https://www.espressif.com/en/products/longevity-commitment

[olimex-can]: https://www.olimex.com/Products/OLinuXino/A20/A20-CAN-ISO/open-source-hardware
[olimex-sch]: https://github.com/OLIMEX/A20-CAN-ISO/blob/ca00943e6385a4c8b9c4c8e3a69489aa078ce446/HARDWARE/A20-CAN-ISO-Rev_B/A20-CAN-ISO_Rev_B.pdf
[olimex-doc]: https://www.olimex.com/Products/OLinuXino/A20/A20-CAN/resources/EU-DOC-A20-CAN.pdf
[olimex-oshwa]: https://certification.oshwa.org/bg000063.html
[olimex-rs]: https://www.olimex.com/Products/Modules/Interface/MOD-RS485-ISO/
[olimex-rs-doc]: https://www.olimex.com/Products/Modules/Interface/MOD-RS485-ISO/resources/EU-DOC-MOD-RS485-ISO.pdf
[power]: https://www.pololu.com/product/4085
[power-eu]: https://botland.store/276-converters-step-up-step-down
