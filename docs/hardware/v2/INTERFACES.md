# Wind and NMEA2000 interface decisions

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical pin allocation](../../ESP32-S3-RLCD-4.2.md) · [Supplier register](SOURCING_AND_EVIDENCE.md)

## CAN decision

**Olimex A20-CAN-ISO** is the first prototype candidate. It combines signal isolation and isolated power, an EU manufacturer/store, a signed board EMC/RoHS declaration and a lower price than the shortlisted Click modules. Its normally open termination suits a network drop. The tradeoffs are its unusual carrier connection, 5 V supply and unresolved safe-startup circuit.

**★** = best documented fit for the row; **▼** = disadvantage for this v2 design; **?** = not established. Unmarked values are neutral or not directly comparable. Unknown evidence is not a failure.

Prices are **EUR excluding VAT**, unless marked otherwise. See the [supplier register](SOURCING_AND_EVIDENCE.md#price-and-quantity-snapshot) for dated quotes, conversions and stock. “Yes” in a compliance row applies only to the stated board, not the assembled Veetr product.

| Criterion | Olimex A20-CAN-ISO | CAN Isolator 3 Click | CAN Isolator Click | CAN Isolator 2 Click | TI ISOW1044DFMEVM |
| --- | --- | --- | --- | --- | --- |
| **Decision** | **★ Preferred prototype** | Conditional alternative | Older alternative | ▼ Extra supply needed | Lab reference |
| Board / transceiver | TJA1052 | MIKROE-5785 / MAX14882 | MIKROE-2627 / ADM3053 | MIKROE-4809 / ISO1042 | ISOW1044 EVM |
| **Price, EUR net** | **★ €15.95** | €46.38 historical¹ | ? | ?; supply extra | ? |
| **EU seller** | [Olimex, BG][olimex-can] | [TME][can3-eu] | ? | ? | [Mouser][can-evm-eu] |
| **US seller** | ? | ? | [TME US][can1-us] | ? | [TI][can-evm] |
| Manufacturer | [Olimex][olimex-can] | [MikroE][can3-buy] | [MikroE][can1-buy] | [MikroE][can2] | [TI][can-evm] |
| **Listed stock** | In stock; count ? | 0 historical¹ | ? | ? | ? |
| Supply history | Drawing 2016; OSHWA 2020 | Click family; no commitment | Documented since 2017 | No commitment recorded | Evaluation product |
| **Quality evidence** | Schematic + signed board DoC | Published schematic | Published schematic | Vendor documentation | EVM documentation |
| **Signal isolation** | Yes | Yes | Yes | Yes | Yes |
| **Isolated power included** | Yes; F0505S-2WR2 | Yes | Yes | ▼ No; external bus supply | Yes |
| **Supply / logic** | 5 V + 3.3 V / 3.3 V | **★ 3.3 or 5 V selectable** | 5 V / 3.3 V-compatible | Separate logic/bus supplies | See EVM rail setup |
| **Board current** | ? | ? | ? | ? | ? |
| **Board operating temperature** | ? | ? | ? | ? | ? |
| **Carrier connection** | 40-pin connector | mikroBUS | mikroBUS | mikroBUS + supply | Evaluation connectors |
| **Drop termination** | **★ Jumpers normally open** | ▼ Fixed 112 Ω; factory DNP | ▼ Populated split termination | Confirm revision | ▼ Populated termination |
| **Assembly for v2** | Keyed carrier mating | Factory unterminated variant | Factory termination setup | Additional isolated converter | ▼ Embedding review |
| **CE / EU DoC — board** | [**Yes — EMC**][olimex-doc] | Unknown | Unknown | Unknown | [**Yes — RoHS only**][ti-doc]² |
| **RoHS — board** | [**Yes**][olimex-doc] | Unknown | Unknown | Unknown | [**Yes**][ti-doc] |
| **REACH / FCC — board** | Unknown / Unknown | Unknown / Unknown | Unknown / Unknown | Unknown / Unknown | Unknown / Unknown |
| **Hardware license** | **★ [CERN OHL 1.2][olimex-license]** | ? | ? | ? | Evaluation terms |
| Host integration | TWAI + NMEA stack | TWAI + NMEA stack | TWAI + NMEA stack | TWAI + NMEA stack | TWAI + NMEA stack |
| Deciding test | Safe startup, traffic, isolation | Unterminated drop and cost | Assembly advantage | Complete installed cost | Bench characterization |

¹ Historical quotes/stock are from 2026-10-13; other recorded quotes are dated 2026-11-17. The price marker compares known quotes only. ² TI’s signed 2021-03-25 declaration covers ISOW1044DFMEVM under RoHS 2011/65/EU and amendment 2015/863; it does not declare EMC conformity. Olimex’s signed 2021-07-08 declaration explicitly covers A20-CAN-ISO under EMC and RoHS; it does not establish REACH or FCC status.

V1 has no CAN interface. Generic non-isolated breakouts are excluded because the selected architecture requires isolation.

No complete-board current or temperature envelope has been qualified for Veetr. Measure the selected CAN module at idle, normal traffic and maximum intended traffic, including isolated converter overhead. IC isolation and temperature ratings cannot be applied to the assembled carrier. Compare prices, stock and license evidence in the [supplier register](SOURCING_AND_EVIDENCE.md); those gaps remain explicit rather than filled with chip ratings.

### Olimex mating interface

Use the [isolated design repository][olimex-sch], not the generic non-isolated A20-CAN drawing. At the pinned revision, the Rev_B directory contains a schematic titled Rev_A, dated 2016-04-04. Match the received PCB and population before wiring.

| Module connection | Signal / destination |
| --- | --- |
| GPIO3 connector pin 1 | Local regulated 5 V |
| GPIO3 connector pin 3 | Local 3.3 V logic supply |
| GPIO3 connector pins 2, 4 | Local ground |
| GPIO3 connector pin 33 | CAN-TX, from MCU TWAI TX |
| GPIO3 connector pin 35 | CAN-RX, to MCU TWAI RX |
| CAN1 pin 1 | Isolated CAN reference |
| CAN1 pin 2 | CANL |
| CAN1 pin 3 | CANH |

“GPIO3” here is Olimex's connector name. It is not ESP32 GPIO3. The 40-pin module connector must not plug directly into Waveshare P1. Keep both termination jumpers open for a normal drop. Confirm unpowered resistance, ground separation, pin orientation and exact connector population.

The MCU's native TWAI controller needs a physical transceiver, not a UART-to-CAN converter. Vendor header names such as UART TX/RX do not change that requirement. The [Espressif documentation][twai] describes this controller/transceiver split.

GPIO43 can emit boot UART traffic. The target carrier needs a hardware means to keep CAN recessive during reset, programming, brownout and incompatible firmware operation. This is an unresolved circuit requirement, not a capability assumed of the Olimex board. Do not attach the rewired unit to a boat network until it is demonstrated.

## Wind RS485 decision

Retain the existing converter as the reference for the next bench build. It must present 3.3 V-compatible logic regardless of its supply label. The wind head needs 5 V, and its battery supply is a separate [power decision](POWER.md). Do not confuse the sensor supply with transceiver logic voltage.

| Criterion | Existing v1 converter | RS485 Isolator 2 Click | Olimex MOD-RS485-ISO |
| --- | --- | --- | --- |
| **Decision** | **★ Bench reference** | Isolated upgrade candidate | Protocol review first |
| Board / transceiver | Exact SKU ? | MIKROE-3863 / ADM2867E | ISO35T + onboard PIC |
| **Price, EUR net** | Replacement ?; reuse €0 | €40.68 historical¹ | **★ €16.95** historical¹ |
| **EU seller** | ? | [TME][rs485-eu] | [Olimex, BG][olimex-rs] |
| **US seller** | ? | ? | ? |
| Manufacturer / original listing | [V1 purchase][rs485-v1] | [MikroE][rs485] | [Olimex][olimex-rs] |
| **Listed stock** | Owned | 0 historical¹ | In stock, historical¹; count ? |
| Supply commitment | ? | ? | ? |
| **Quality evidence** | Working wind acquisition | Published design | Signed board DoC |
| **Signal / power isolation** | ? / ? | Yes / Yes | Yes / Yes; review system boundary |
| **Supply / logic** | Verify board; require 3.3 V I/O | Confirm configured rails / 3.3 V host | Verify UEXT rails / host levels |
| **Board current / temperature** | ? / ? | ? / ? | ? / ? |
| **Carrier connection** | Existing wires | mikroBUS | UEXT |
| **9600 8E1 wind operation** | **★ Working** | Half-duplex setup needed | ▼ PIC transparency unverified |
| **Assembly for v2** | Reuse | ▼ Factory solder-jumper setup | UEXT harness/carrier |
| **CE / EU DoC — board** | Unknown | Unknown | [**Yes — EMC**][olimex-rs-doc] |
| **RoHS — board** | Unknown | Unknown | [**Yes**][olimex-rs-doc] |
| **REACH / FCC — board** | Unknown / Unknown | Unknown / Unknown | Unknown / Unknown |
| **Hardware / firmware license** | ? | ? | Exact board/PIC terms to verify |
| **V1 lesson / migration** | Preserve DE timing and 8E1 | Include wind power in isolation | Extra controller in data path |
| Deciding test | Regression and GPIO3 loading | Wind power/reference isolation | Transparent Modbus exchange |

A complete wind isolation boundary includes sensor power/reference as well as A/B. A non-isolated boost feeding the remote head can defeat an otherwise isolated signal interface if grounds are joined. Resolve that system boundary before calling the wind connection isolated. Keep reset-time GPIO3 loading and bus direction under test.

## Network power integration

The carrier must accommodate power from NET-S/NET-C through a protected isolated converter, as specified in the [power decision](POWER.md#nmea2000-power-and-first-carrier-provision). Fitting that module may be deferred to a later prototype; carrier routing, a fixed module interface, mounting, protection and USB/source selection must be designed from the first PCB.

Keep the network-side CAN reference and network power return on the network side of the isolation boundary. Do not join them to local ground through the power circuit, shields, mounting or test equipment. The CAN board's isolated supply is for its transceiver domain, not for powering Veetr. Freeze the connector power/data pinout and the input load declaration together. A locally powered CAN test remains possible with the network-power option safely unpopulated.

## NMEA2000 feature scope

NMEA2000 is new in v2. The target is classic CAN at 250 kbit/s with 29-bit identifiers, address claim/NAME, product information, supported PGNs, fast-packet handling where needed, validity, source selection and recovery. A working CAN frame exchange alone is not NMEA2000 interoperability or certification.

| Data group | Planned receive behavior | Planned transmit behavior |
| --- | --- | --- |
| Wind | Use configured network wind source when local wind is omitted/unavailable | Publish valid local apparent wind with correct reference; derived wind only when all inputs are fresh |
| Position, SOG, COG and time | Allow selected boat GNSS as source | Publish valid fitted local GNSS data |
| Heading and attitude | Select heading and attitude separately; either may be absent | Publish calibrated valid local outputs with correct magnetic/true reference |
| Pressure | Optional network pressure source | Local pressure only after a qualified sensor/pressure path exists |
| Device information | Discover relevant source devices and supported data | Required identity/product/address management for the selected stack |

The exact PGN list, source priority and rates must be frozen against the chosen stack and licensed specification before transmit implementation. No steering control or arbitrary command forwarding is in scope. Do not echo received measurements back as newly measured local data.

Users may omit local GNSS/IMU/pressure hardware when equivalent network data exists. Sensor absence should not prevent boot or other measurements. Show unavailable/stale values honestly; fallback is possible only if another valid source is fitted or present. Loss of the boat network must not freeze the local wind/display/BLE functions.

Begin with receive-only bench tests. Use a second acknowledged CAN node or suitable CAN interface, a small backbone and two end terminators. Enable transmit after address conflicts, resets, unplug/replug, bus-off recovery and rate limits pass. Keep termination at the backbone ends, not at every drop. Cable, connector, power-reference and shield details require the applicable physical-layer requirements. Product/logo claims require the separate [NMEA certification process][nmea].

## License and qualification

Olimex publishes [CERN OHL v1.2 hardware, GPL3 software and CC BY-SA documentation](https://github.com/OLIMEX/A20-CAN-ISO). Buying the transceiver board does not require adopting its unrelated host software; select and record the ESP32/NMEA stack license separately. NMEA membership, specification access and certification are distinct from any open-source stack license. No stack or license fee has been included in the board-only costs.

Sources: [Olimex product][olimex-can], [signed declaration][olimex-doc], [CAN Isolator 3 schematic][can3-sch], [CAN Isolator schematic][can1-sch], [CAN Isolator 2][can2], [TI evaluation board][can-evm], [RS485 Isolator 2][rs485], [Olimex RS485][olimex-rs].

[can3-sch]: https://download.mikroe.com/documents/add-on-boards/click/can-isolator-3-click/can_isolator_3_click_v100_Schematic.PDF
[can1-sch]: https://download.mikroe.com/documents/add-on-boards/click/can-isolator/can-isolator-click-schematic.pdf
[can2]: https://www.mikroe.com/can-isolator-2-click
[can-evm]: https://www.ti.com/tool/ISOW1044DFMEVM
[rs485]: https://www.mikroe.com/rs485-isolator-2-click
[twai]: https://docs.espressif.com/projects/esp-idf/en/v5.4/esp32s3/api-reference/peripherals/twai.html
[nmea]: https://www.nmea.org/nmea-2000.html
[olimex-can]: https://www.olimex.com/Products/OLinuXino/A20/A20-CAN-ISO/open-source-hardware
[olimex-sch]: https://github.com/OLIMEX/A20-CAN-ISO/blob/ca00943e6385a4c8b9c4c8e3a69489aa078ce446/HARDWARE/A20-CAN-ISO-Rev_B/A20-CAN-ISO_Rev_B.pdf
[olimex-doc]: https://www.olimex.com/Products/OLinuXino/A20/A20-CAN/resources/EU-DOC-A20-CAN.pdf
[olimex-rs]: https://www.olimex.com/Products/Modules/Interface/MOD-RS485-ISO/

[can3-eu]: https://www.tme.eu/de/details/mikroe-5785/erweiterungsboards/mikroe/
[can3-buy]: https://www.mikroe.com/can-isolator-3-click
[can1-buy]: https://www.mikroe.com/can-isolator-click
[can1-us]: https://www.tme.com/us/en-us/details/mikroe-2627/add-on-boards/mikroe/can-isolator-click/
[can-evm-eu]: https://www.mouser.es/es/ProductDetail/Texas-Instruments/ISOW1044DFMEVM?qs=TuK3vfAjtkU%2FNoFUJrmHuQ%3D%3D
[olimex-license]: https://github.com/OLIMEX/A20-CAN-ISO
[rs485-eu]: https://www.tme.eu/fr/details/mikroe-3863/plaques-d-expansion/mikroe/
[rs485-v1]: https://www.aliexpress.com/item/32688467460.html
[olimex-rs-doc]: https://www.olimex.com/Products/Modules/Interface/MOD-RS485-ISO/resources/EU-DOC-MOD-RS485-ISO.pdf

[ti-doc]: https://www.ti.com/lit/pdf/SSZQOY6
