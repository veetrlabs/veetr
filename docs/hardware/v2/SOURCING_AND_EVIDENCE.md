# V2 sourcing, supply and evidence register

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Prototype quantities](PROTOTYPE_ORDER.md) · [Project compliance status](../../COMPLIANCE.md)

## Price and quantity snapshot

Reviewed **2026-11-17**, except entries explicitly marked historical. Prices exclude shipping; USD manufacturer prices are before destination taxes. EU VAT status is stated per row. Currency conversion and destination VAT must be applied to a single dated quote before comparing totals. A regional website does not establish warehouse location or sufficient stock for a production run.

| Exact part | EU sourcing route | US sourcing route | Price evidence | Quantity / purchase condition |
| --- | --- | --- | --- | --- |
| Waveshare ESP32-S3-RLCD-4.2 / WS-33298 | [BerryBase][rlcd-eu] | US distributor not verified; manufacturer fallback | Current EU quote required; €30–45 net engineering allowance only | Reuse PoC first; exact board revision, stock and lead time unconfirmed |
| SparkFun GPS-18037 MAX-M10S | [Botland][gnss-botland] | [SparkFun][gnss-sparkfun] | US$45.95 manufacturer; EU quote required | Manufacturer page shows both in-stock and backorder controls; confirm dispatch/quantity. EU quantity unconfirmed |
| Waveshare LC76G / RPishop WAV579 | [RPishop](https://rpishop.cz/498293/waveshare-lc76g-multi-gnss-modul/) | US distributor not verified | 379.34 Kč excluding VAT | RPishop displays 5+; confirm AB variant and package antenna/harness contents |
| MIKROE-4643 GNSS MAX Click | EU route requires quote; [manufacturer][gnss-click] is in Serbia, outside EU | [DigiKey regional listing][gnss-digikey]; US fulfillment unconfirmed | US$54 manufacturer | Quantity unconfirmed; no native QT; not preferred |
| Adafruit 4754 BNO085 / ADA4754 | [BerryBase](https://www.berrybase.de/en/adafruit-9-dof-orientation-imu-fusion-breakout-bno085-bno080/) | [Adafruit](https://www.adafruit.com/product/4754) | €37.50 incl. VAT at BerryBase; US$29.50 at Adafruit | BerryBase displays 100+; Adafruit in stock without count. Confirm batch quote; price tiers are not inventory |
| MIKROE-6369 Smart DOF 4 Click | EU distributor quote required; [manufacturer][imu-click] outside EU | US distributor not verified | US$65 manufacturer | Quantity unconfirmed; I²C solder configuration required |
| Olimex A20-CAN-ISO | [Olimex Bulgaria direct][olimex-can] | US distributor not verified | €15.95 net; €14.36 at 10–49; €12.76 at 50+ | Listed in stock, no count; tiers do not prove quantity. Confirm ISO variant and connectors |
| MIKROE-5785 CAN Isolator 3 | [TME][can-tme] | US distributor quote required | Historical 2026-10-13: €46.38 net | Historical TME stock 0; current quote and factory unterminated variant required |
| MIKROE-2627 CAN Isolator | [Manufacturer][can1-history]; EU quote required | [TME US listing][can1-tme] | Current quote required | Configuration, stock and delivery unconfirmed |
| MIKROE-4809 CAN Isolator 2 | [Manufacturer][can2]; EU quote required | US quote required | Current quote required | Extra isolated supply adds cost; not baseline |
| TI ISOW1044DFMEVM | [Mouser EU listing][can-evm-eu] | [TI][can-evm] | Current quote required | Evaluation board; not selected for carrier production |
| Existing wind head / RS485 converter | Reuse; exact supplier SKU to record | Not established | Incremental prototype cost €0 when reused; replacement cost unknown | Identify labels, logic levels and sensor current before ordering equivalents |
| MIKROE-3863 RS485 Isolator 2 | [TME][rs485-tme] | US quote required | Historical 2026-10-13: €40.68 net | Historical stock 0; current quote and factory half-duplex setup required |
| Olimex MOD-RS485-ISO | [Olimex direct][olimex-rs] | US distributor not verified | Historical 2026-10-13: €16.95 net | Protocol suitability and current stock must be confirmed |
| Isolated NMEA2000 power input / source selector | Exact EU module and protection parts to select | US alternative to establish | Quote pending; include protection, mounting and USB/source selection | Required carrier provision; module may be unpopulated initially. Fixed footprint or keyed interface must be frozen before PCB fabrication |
| Pololu 2562 U1V11F5 | [Botland listing](https://botland.store/converters-step-up/1893-step-up-voltage-regulator-u1v11f5-5v-12a-pololu-2562-5904422308230.html); current listing/quote needs confirmation | [Pololu](https://www.pololu.com/product/2562) | US$8.95 current; historical EU 2026-10-13 €5.46 net | Active and Preferred; no current count verified; headers require fitting |
| Pololu 4085 S13V20F5 | [Botland regulator catalogue][power-eu]; exact SKU quote required | [Pololu][power] | US$17.95 current | Active and Preferred; count unconfirmed; optional comparison unit |
| Kingston SDCIT2/8GB | [TME][sd-tme] | Exact US listing not verified; [manufacturer][sd-maker] | €10–20 net allowance, not quote | Exact suffix, endurance sheet, temperature and current stock required |
| Adafruit 4162 VEML7700 | EU distributor quote required | [Adafruit](https://www.adafruit.com/product/4162) | US$4.95 | Manufacturer shows 42; optional light experiment |
| Adafruit 4816 BMP390 | [BerryBase ADA4816](https://www.berrybase.de/adafruit-bmp390l-praezisions-druck-und-hoehenmesser-breakout-stemma-qt) | [Adafruit](https://www.adafruit.com/product/4816) | €10.50 incl. VAT / US$10.95 | Included in prototype BOM; both listings unavailable at review; confirm restock or alternate exact-SKU distributor |
| BOPLA 52042000 DAE M12 9005 | [TME DAE-M12X1.5](https://www.tme.eu/en/details/dae-m12x1.5/enclosures-other-accessories/bopla/52042000/) | [TME US](https://www.tme.com/us/en-us/details/dae-m12x1.5/enclosures-other-accessories/bopla/52042000/) | [Indexed Czech listing](https://www.tme.eu/cz/details/dae-m12x1.5/krabicky-ostatni-prislusenstvi/bopla/52042000/): 786.88 Kč net / 952.13 Kč gross **per five-pack**; re-quote before ordering | Order 1 pack of 5; fit 1 per unit/coupon. Indexed regional stock differs (10/50); quantity units/current stock require confirmation |

Manufacturer links are the durable identity reference when a distributor changes URLs or redirects to a regional home page. Search the exact part number rather than substituting a visually similar module. Confirm the actual quoted quantity before authorizing an order.

## Evidence and license comparison

A module certificate does not certify the assembled Veetr product. The [compliance register](../../COMPLIANCE.md) records project status; this table records why evidence does or does not support component selection.

| Part / family | Regulatory evidence available | License evidence | Supply confidence and gap |
| --- | --- | --- | --- |
| ESP32-S3 on Waveshare | [Espressif CE/FCC catalogue][esp-cert] for radio module; exact-board declaration not recorded | Vendor schematics/examples available; whole-board design reuse terms not established | [ESP32-S3 commitment][longevity] at least 12 years from 2021 applies to chip, not panel or RLCD assembly |
| MAX-M10S breakouts | [u-blox RED/RoHS declaration][gnss-doc] for module/configuration; not automatic SparkFun/Click approval | [SparkFun hardware CC BY-SA 4.0](https://github.com/sparkfun/SparkFun_u-blox_MAX-M10S/blob/main/LICENSE.md); library and receiver firmware separate | Current module datasheet identifies production variants; no breakout delivery commitment; both boards share module dependency |
| LC76G Waveshare | Exact-board EU/US declarations not established in project | Design/host-code redistribution terms not established; vendor module firmware | EU stock snapshot supports a small comparison order, not long-term capacity |
| Adafruit BNO085 | Exact-board CE/FCC/REACH evidence not established | [PCB CC Attribution/Share-Alike](https://github.com/adafruit/Adafruit-BNO08x-PCB); host library separate; internal fusion firmware vendor-supplied | Product documented since 2020; no binding future supply commitment |
| Olimex A20-CAN-ISO | [Signed EMC/RoHS DoC][olimex-doc] covers ISO variant; FCC/REACH evidence not recorded | [CERN OHL v1.2 hardware; GPL3 software; CC BY-SA docs](https://github.com/OLIMEX/A20-CAN-ISO) | Drawing dates to 2016, [OSHWA record][olimex-oshwa] to 2020, currently listed; useful history, no capacity guarantee |
| Olimex MOD-RS485-ISO | [Board EMC/RoHS DoC][olimex-rs-doc] | Review exact board/PIC sources before adapting firmware | Current revision, protocol and delivery quote still required |
| MikroE Click alternatives | Exact-board signed EU/FCC/REACH evidence not recorded here; isolator IC certificates have narrower scope | Schematics available; review exact board and SDK terms before copying/integrating | CAN predecessors documented since 2017; ecosystem history does not guarantee a particular SKU |
| TI CAN EVM | [TI board-specific EU DoC listing][can-evm] | Evaluation/embedding terms require review | Lab evidence useful; not chosen as production module |
| Pololu regulators | Supplier RoHS evidence recorded for 2562; complete-board CE/FCC evidence not established | Hardware design reuse license not established; no host firmware required | Active/Preferred status and quantity tiers; no committed inventory or lifetime |
| Network power input | Exact module and assembled input evidence pending; isolated CAN evidence does not cover this supply | Module design reuse terms and any controller firmware to review | Select input/output ratings, EU sourcing, lifecycle and fixed carrier interface before fabrication |
| BOPLA pressure vent | Manufacturer fresh-water component ingress tests; no Veetr enclosure or saltwater qualification established | Mechanical purchased part; design reuse terms not established | Part documented in 2019 manufacturer sheet and current catalogue; multiyear commitment unconfirmed. [Manufacturer sheet](https://docs.rs-online.com/aea6/0900766b811170c1.pdf) |
| Optional sensors / battery / card / connectors | Exact selected BOM evidence incomplete | Host libraries and any copied designs require revision-specific license capture | Battery, antenna, lighting and protection SKUs still open; selected vent mounting hardware to finalize |

## Meaning of evidence in this project

| Evidence | Selection use and limitation |
| --- | --- |
| CE / signed EU Declaration of Conformity | Manufacturer declares an identified product against applicable legislation; scope/model matters. Not a generic quality or marine reliability certificate |
| RoHS | Restricted-substance compliance; does not establish EMC, RF or environmental durability |
| REACH | Chemical/substance obligations and supplier information; separate from radio authorization and RoHS |
| FCC module grant | US radio authorization subject to integration conditions; host emissions, antenna, RF exposure and labeling remain relevant |
| Isolator component approvals | Defined insulation properties of the component; not proof of carrier surge or lightning survival |
| OSHWA / open-hardware license | Design openness and reuse terms; not electrical or regulatory approval |
| NMEA2000 certification | Separate network/protocol/product assessment; not CE/FCC or waterproofness |

Primary references: [EU manufacturer obligations][eu-ce], [EU RoHS][eu-rohs], [ECHA REACH][reach], [FCC modular integration guidance][fcc], [NMEA][nmea].

## Production quote requirements

The selected prototype parts still need 10/100/500-unit quotes with lead time, exact PCB/BOM revision, substitution control, PCN/EOL notices and last-time-buy terms. Ask for model-specific conformity evidence and accessory/assembly scope. An EU reseller listing and a predecessor's longevity support investigation; neither establishes a future supply contract.

Compare total installed cost including antenna, connector preparation, headers, carrier assembly, protection, enclosure, battery, labour and test yield. Keep VAT/shipping consistent. No v1-versus-v2 savings claim is supported until the same cost scope is priced for both.

[rlcd-eu]: https://www.berrybase.de/es/waveshare-esp32-s3-rlcd-aiot-reflexionsdisplay-dev-board-4-2-zoll-300x400-gpio-i2c-uart-akku
[esp-cert]: https://www.espressif.com/en/support/documents/certificates
[gnss-click]: https://www.mikroe.com/gnss-max-click
[gnss-digikey]: https://www.digikey.ie/en/products/detail/mikroelektronika/MIKROE-4643/20840833
[gnss-doc]: https://content.u-blox.com/sites/default/files/documents/MAX-M10_RED_Conformity_UBX-22013367.pdf
[gnss-sparkfun]: https://www.sparkfun.com/sparkfun-gnss-receiver-breakout-max-m10s-qwiic.html
[gnss-botland]: https://botland.store/gps-modules/22065-gnss-max-m10s-module-qwiic-sparkfun-gps-18037.html
[can-tme]: https://www.tme.eu/de/details/mikroe-5785/erweiterungsboards/mikroe/
[can1-tme]: https://www.tme.com/us/en-us/details/mikroe-2627/add-on-boards/mikroe/can-isolator-click/
[can1-history]: https://www.mikroe.com/blog/can-isolator-click-provides-isolated-can-communication
[can2]: https://www.mikroe.com/can-isolator-2-click
[can-evm]: https://www.ti.com/tool/ISOW1044DFMEVM
[can-evm-eu]: https://www.mouser.es/es/ProductDetail/Texas-Instruments/ISOW1044DFMEVM?qs=TuK3vfAjtkU%2FNoFUJrmHuQ%3D%3D
[rs485-tme]: https://www.tme.eu/fr/details/mikroe-3863/plaques-d-expansion/mikroe/
[sd-maker]: https://www.kingston.com/en/memory/search?partid=SDCIT2%2F8GB
[sd-tme]: https://www.tme.eu/en/details/sdcit2_8gb/memory-cards/kingston-technology/
[nmea]: https://www.nmea.org/nmea-2000.html
[eu-ce]: https://single-market-economy.ec.europa.eu/single-market/goods/ce-marking/manufacturers_en
[eu-rohs]: https://environment.ec.europa.eu/topics/waste-and-recycling/rohs-directive_en
[reach]: https://echa.europa.eu/regulations/reach/understanding-reach
[fcc]: https://apps.fcc.gov/oetcf/kdb/forms/FTSSearchResultPage.cfm?id=44637&switch=P
[longevity]: https://www.espressif.com/en/products/longevity-commitment
[olimex-can]: https://www.olimex.com/Products/OLinuXino/A20/A20-CAN-ISO/open-source-hardware
[olimex-doc]: https://www.olimex.com/Products/OLinuXino/A20/A20-CAN/resources/EU-DOC-A20-CAN.pdf
[olimex-oshwa]: https://certification.oshwa.org/bg000063.html
[olimex-rs]: https://www.olimex.com/Products/Modules/Interface/MOD-RS485-ISO/
[olimex-rs-doc]: https://www.olimex.com/Products/Modules/Interface/MOD-RS485-ISO/resources/EU-DOC-MOD-RS485-ISO.pdf
[power]: https://www.pololu.com/product/4085
[power-eu]: https://botland.store/276-converters-step-up-step-down
[imu-click]: https://www.mikroe.com/smart-dof-4-click
