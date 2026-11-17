# V2 prototype order and test plan

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Prices and suppliers](SOURCING_AND_EVIDENCE.md)

Purpose: build one instrument prototype while preserving a working v1/PoC reference, then qualify the decisions that control carrier layout. This is a staged procurement BOM, not a released production BOM. “Reuse” depends on inventory inspection; “hold” requires the named specification before ordering that item.

## Procurement gate

All new purchases, including comparison boards, must meet the [production component selection](PRODUCTION_SELECTION.md). Archive exact-board compliance evidence with the quote, supplier and revision; confirm quantity/lead time and substitution control. Existing v1/PoC parts are regression references. The RLCD whole-board evidence, wind head identity and several power/assembly parts remain unresolved, so this is not yet an order-ready complete BOM.

## First bench build

| Item | Quantity | Action / exact identity | Included work and order gate |
| --- | --- | --- | --- |
| RLCD controller | 1 | Reuse ESP32-S3-RLCD-4.2; buy same model only if unavailable | Record PCB revision/R7 and P1 orientation; retain original wiring until bus gate passes |
| V1 reference | 1 complete unit or recorded baseline | Preserve DevKitC, existing GNSS, IMU, wind and converter | Photograph exact markings; capture known firmware/settings and logs before moving modules |
| Preferred GNSS | 1 | SparkFun GPS-18037 MAX-M10S | EU quote/dispatch confirmation; native fitted Qwiic ports |
| GNSS antenna | 1 | Hold exact SMA antenna SKU unless existing unit is verified compatible | Match active/passive type, bias voltage/current, connector gender and enclosure placement |
| Preferred IMU | 1 | Adafruit 4754 BNO085 | Fitted QT connectors; no headers needed for four-wire test |
| Barometer | 1 | Adafruit 4816 BMP390 QT | Included in prototype order; confirm restock or another distributor for this exact SKU |
| I²C cables | 3 + 1 spare | Four-pin JST-SH 1.0 mm Qwiic/QT, initially 100 mm | Confirm straight-through pin mapping; cables do not support board weight |
| SD card | 1 | Kingston SDCIT2/8GB after exact-part quote; existing card for smoke test | No SD breakout; record media identity and filesystem |
| Wind sensor and converter | 1 each | Reuse existing working units | Measure running/startup load and verify logic voltage; do not buy an assumed equivalent |
| Wind boost candidate | 1 | Pololu 2562 U1V11F5 | Assembler-fitted headers; bench evaluation only until load and protected power path pass |
| CAN module | 1 | Olimex A20-CAN-ISO | Confirm ISO variant, open termination, PCB and connector population |
| Module mating harness | 1 set | Hold keyed Olimex-to-carrier harness until connector population confirmed | Map isolated/local domains; no direct P1-to-Olimex connector mating |
| Bench supplies and measurement | 1 setup | Reuse current-limited supply, meter and scope/logic analyzer | Observe startup peaks, I²C timing and reset behavior; avoid test-ground bridges across isolation |

All purchasable module identities and supplier links are in the [supplier register](SOURCING_AND_EVIDENCE.md#price-and-quantity-snapshot). Request prepared headers/configuration where required; loose Dupont wiring is for supervised bench work only.

## Deliberate comparison and optional items

| Item | Quantity | Purpose / ordering condition |
| --- | --- | --- |
| SparkFun GPS-21834 SAM-M10Q | 0–1 | Integrated-antenna GNSS comparison; documented Botland board RoHS route; confirm quote/dispatch |
| Waveshare LC76G, RPishop WAV579 | Hold | Exact-board RoHS evidence required before a comparison purchase |
| SparkFun SEN-22857 BNO086 | Hold | Board RoHS evidence recorded; allocate INT/RST before considering an order |
| SparkFun SEN-20170 BMP581 | 0–1 | Pressure alternative if sustainable BMP390 supply cannot be confirmed; select one pressure board |
| Pololu 4085 S13V20F5 | 0–1 | Order if measured wind/CAN load warrants comparing a larger or combined 5 V supply |
| Adafruit 4162 VEML7700 | 0–1 | Ambient sensing for a night-light experiment; add one QT cable and a documented port/chain |
| LED / front-light sample set | Hold | Choose optics and driver approach; no final SKU, GPIO or load budget yet |
| Isolated RS485 alternative | 0 initially | Order only after protocol/jumper review, exact factory setup and isolation-boundary design |

## Carrier and enclosure order — after bench gates

| Item | Quantity for one unit | Information required before fabrication/order |
| --- | --- | --- |
| Assembled carrier PCB | 1 plus supplier's minimum spare quantity | Final module footprints, keyed connectors, mounting, bus pull-ups, power/protection circuit, CAN startup inhibit and reserved isolated network-power integration |
| Compatible protected single-cell battery | 1 | Exact cell, fit, connector polarity, charging limits, protection and supplier safety/transport evidence |
| Battery power-path / adapter | 1 | Protected switched battery access, charging/current limits and USB/network/battery switchover; no backfeeding or boost-to-charger loop |
| Network power provision | 1 carrier provision; 0–1 fitted module initially | Mandatory first-PCB fixed interface/footprint, mounting, isolation clearances, protection and source-selection design; converter/protection SKUs pending |
| NMEA2000 drop connector/lead | 1 | Exact compatible connector SKU, pin numbering, shielding, sealing and strain relief |
| CAN bench network | 1 | Two backbone end terminators, tee/drop arrangement and a second known working acknowledged CAN node/interface |
| Water-barrier pressure vents | 1 pack of 5; fit 1 per enclosure/coupon | BOPLA 52042000, TME DAE-M12X1.5; supplied O-ring; allocate remaining vents to test coupons and spares |
| Vent mating hardware | 1 set per mounted vent | Confirm supplied contents; matching M12 × 1.5 counter nut if required by wall design, manufacturer drawing/torque and smooth sealing land |
| Splash shield and test coupon | 1 representative coupon + enclosure feature | Recessed hood/baffle, indirect air path, exterior drainage, replaceable vent; validate dimensions before final print |
| Enclosure, window, seals and tray | 1 set | Board placement, antenna clearance, front-light experiment, all-face wave exposure and service access |
| Fasteners, retention and cables | 1 set | Actual board hole patterns, stack heights, cable bend/retention and corrosion-resistant materials |
| Input protection | 1 set | Exact ESD/transient/fuse/reverse-polarity design appropriate to each external interface |

Do not send a carrier to fabrication while these entries remain unspecified. Network-power module population may be deferred, but the [first-carrier provisions](POWER.md#required-provisions-on-the-first-carrier) must be resolved. Order a documented unpopulated variant with a safe disconnected NET-S branch and a later upgrade BOM; no carrier respin should be needed to fit the selected power option. A second ESP32 plus suitable CAN transceiver can provide bench traffic, but it does not replace testing against a known NMEA2000 implementation.

## Cost model

Use the supplier register as the single price ledger. It records EUR equivalents alongside original quote currencies and VAT bases. Build three quote totals: unchanged new-build v1, v2 with reused prototype parts, and complete new-build v2.

| Cost group | Include |
| --- | --- |
| Core electronics | Controller, GNSS + antenna, IMU, BMP390, wind head + converter, SD |
| V2 additions | CAN + mating/protection, isolated network-power input + source selection, battery + power path + 5 V conversion, optional light. Separate first-build unpopulated cost from fitted-option cost |
| Assembly | Carrier PCB/assembly, fitted headers, configured jumpers, cables, mounting |
| Product enclosure | Window, seals, entries, pressure vent + mating hardware, splash shield, fasteners, strain relief and finishing; separate five-pack purchase cost from per-unit vent cost |
| Delivered cost | Same currency/date, destination VAT, shipping and import/handling basis |
| Separate development cost | Comparison boards, instruments, firmware integration and qualification/certification |

A complete order total remains blocked by antenna, battery/power path, carrier, enclosure and several supplier quotes. The v1 approximate electronics estimate has different scope and date; it cannot establish v2 savings. Optional sensors and comparison equipment must remain separate from the minimum production BOM.

## Test stages

These are proposed prototype acceptance gates, not claims of completed tests. Set application-specific accuracy, freshness, runtime and environmental targets before the relevant measurement campaign; missing targets prevent a pass. The finite repetition counts below are initial engineering screens, not lifetime qualification.

| Stage | Setup and test | Required evidence / exit condition |
| --- | --- | --- |
| T0 — identify reference | Photograph v1/PoC boards and labels; capture working firmware/configuration and representative wind/GNSS/IMU/BLE/display behavior | Exact baseline manifest; distinguish measured values from estimates |
| T1 — board/power safety | Unpowered orientation/continuity, R7 population, supply polarity, GPIO3 reset bias; current-limited power-up | Matches canonical wiring; no unintended short, 5 V logic exposure or protection bypass |
| T2 — SD + existing wind | Vendor SD write/read, then concurrent logging and Modbus; 20 cold boots and 20 USB transitions | No wind regression or boot failure; correct file data; record interruption/recovery behavior |
| T3 — shared I²C | MAX-M10S + BNO085 + onboard devices, short QT cables; protocol IDs, pull-ups/edges, 20 cold boots, 8 h combined display/SD/radio workload | No unrecovered bus lock; measured per-source age and missed reports meet recorded rate/latency targets; faults do not freeze remaining functions |
| T4 — GNSS / IMU comparison | Compare v1, preferred parts and LC76G if ordered; same exposure/route, stationary and moving, power/radio load changes | Recorded fix acquisition/recovery, SOG/COG stability, heading/attitude and power; justify winner with results, not brand/axis count |
| T5 — battery and wind | Measured wind startup, low battery, CAN load, SD/radio bursts, charge transitions and off-state draw | Rail minima/peaks and temperatures within actual component limits with stated margin; runtime target met; correct cutoff and no VBUS backfeed |
| T5N — network power | Fitted isolated input: 9–16 V, full load plus charging, inrush, USB/network/battery transitions, backfeed and ground-domain checks | Declared network load/LEN, rail and thermal margins, safe charging; no backfeed, isolation bypass or battery-to-charger loop. Unpopulated first build instead requires inspection of safe disconnect and upgrade interface |
| T6 — CAN electrical | Isolated/local domain checks, termination, two-node frames/ACK, reset/program/unpowered behavior | Correct signaling and supply, no unintended ground bridge or unwanted CAN transmissions during startup; use qualified lab for dielectric-rated tests |
| T7 — NMEA2000 | Receive first, then approved PGNs/address claim, conflicts, bus-off, disconnects, validity and source priority | Interoperability logs; no echo loop; selected rates/bus load; absent sensors and stale network data handled correctly |
| T8 — mechanics and options | Cable vs socket assembly; retention/vibration; heading with final placement; wet/night front-light tests | Chosen mounting documented; no intermittent connections, unacceptable glare/feedback or magnetic interference |
| T8P — pressure path | BMP390, representative vent/hood/drains and sheltered reference; pressure/temperature changes, wind directions/heel, freshwater spray, salt, flooded recess and drying | Recorded offset, lag and recovery within agreed targets; no internal ingress; inspect vent seal/drainage. Do not infer enclosure IP rating from vent rating |
| T9 — enclosure and release | Defined ingress/wave/salt/condensation/temperature campaign, battery and EMC/RF assessments; vented pressure response | Actual reports against agreed limits, revision-controlled BOM and closed critical issues before final specification approval |

T3 is the gate for reassigning UART GNSS pins to CAN. T5 requires a designed power path; the converter alone does not complete it. T6 must pass before connecting to a boat network; T5N must also pass when network power is fitted. A change in board revision, antenna, power converter, enclosure or firmware can invalidate the relevant results.

## Test record and unresolved decisions

For each unit record serial/build ID, supplier lot, PCB revision, actual module markings, firmware commit, wiring revision, sensor settings, card/cell/antenna identity, instruments, conditions, raw logs, pass/fail and corrective action. Store results as linked project evidence when performed; do not mark a part validated based on a documentation review.

The current critical open decisions are: exact v1 wind/current specification; GNSS and IMU shared-bus reliability; protected battery access, isolated network converter/interface, source selection and charging budget; CAN startup inhibit and keyed mating interface; antenna/battery/connector SKUs; final cable-versus-socket mounting; front-light optics/driver; complete price/quantity quotes and product qualification targets. Local barometry and the protected vent are included in the prototype order; remaining gates are sensor supply, vent mounting/hood dimensions and measured atmospheric response after exposure.
