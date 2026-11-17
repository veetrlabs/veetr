# Production component selection

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Supplier register](SOURCING_AND_EVIDENCE.md)

Reviewed **2026-11-17**. New prototype purchases must be credible candidates for the shipped product: exact board identity, documented material compliance, a traceable sourcing route and an integration path that fits Veetr. Reuse of existing v1 hardware provides a regression reference, not approval for a new production purchase.

A board-specific supplier declaration is useful RoHS evidence; a separate third-party certificate is not required for every component. The records below distinguish signed manufacturer declarations from distributor declarations based on supplier information. Neither establishes final-product EMC, radio, ingress or NMEA2000 compliance. “Evidence found” is separate from a production release: quantity/lead-time quotes, revision control and installed testing still matter.

## Board-level RoHS evidence

Botland's declarations below identify the exact marketed board, cite 2011/65/EU and 2015/863, cover all ten restricted substances and state that the declaration is based on supplier information. Their scope is products sold by Botland on or after the declaration date. Preserve the declaration with the actual purchase/revision record; do not silently transfer it to an unidentified clone or another seller's substituted board.

| Exact board | Board RoHS | Evidence and issue date | Selection consequence |
| --- | --- | --- | --- |
| SparkFun GPS-18037 MAX-M10S | **Yes — supplier declaration** | [Botland][max], 2022-11-04 | Retain GNSS integration leader |
| SparkFun GPS-21834 SAM-M10Q | **Yes — supplier declaration** | [Botland][sam], 2023-11-20 | Add integrated-antenna GNSS challenger |
| Adafruit 4754 BNO085 | **Yes — supplier declaration** | [Botland][imu], 2022-11-17 | Retain; ESP32-S3 I²C remains an engineering gate |
| SparkFun SEN-22857 BNO086 | **Yes — supplier declaration** | [Botland][bno], 2024-02-12 | Additional signals required; hold until pin review |
| Adafruit 4816 BMP390 | **Yes — supplier declaration** | [Botland][bmp], 2021-02-09 | Retain candidate; supply continuity unresolved |
| SparkFun SEN-20170 BMP581 | **Yes — supplier declaration** | [Botland][pressure], 2022-09-08 | Add barometer supply alternative |
| Adafruit 4162 VEML7700 | **Yes — supplier declaration** | [Botland][light], 2024-03-01 | Retain optional ambient sensor |
| Pololu 2562 U1V11F5 | **Yes — supplier declaration** | [Botland][boost], current exact-product RoHS section¹ | Retain load-sizing candidate |
| Olimex A20-CAN-ISO | **Yes — signed manufacturer DoC** | [Olimex][can-doc], 2021-07-08; EMC and RoHS | Retain CAN candidate |
| Olimex MOD-RS485-ISO | **Yes — signed manufacturer DoC** | [Olimex][rs-doc], 2021-07-08; EMC and RoHS | Protocol review still required |

¹ Pololu’s page gives an original issue date of 2013-10-21 while its current text includes the later 2015/863 amendment. Treat this as current supplier website evidence; obtain a dated revision with the production quote.

The supplier statements resolve the previously unrecorded board-level RoHS evidence for these particular sourcing routes. They do not establish REACH status or FCC authorization. For an alternative seller, obtain its corresponding exact-part evidence or the manufacturer's declaration. Adafruit [directs requests for 4754 RoHS documentation to support][ada-support].

## Additional GNSS candidate

**SparkFun GPS-21834 SAM-M10Q** is the new alternative to GPS-18037. Both offer Qwiic and the u-blox driver family; antenna placement is the main design choice.

| Criterion | MAX-M10S / GPS-18037 | SAM-M10Q / GPS-21834 |
| --- | --- | --- |
| Decision | **★ External-antenna candidate** | **★ Integrated-antenna candidate** |
| EUR price evidence | €41.81 net US equivalent; antenna extra | €44.29 indexed Mouser price; VAT basis/quote to confirm |
| EU purchase / RoHS route | [Botland][max] | [Botland][sam] |
| US manufacturer store | [SparkFun MAX][max-us] | [SparkFun SAM][sam-us] |
| Listed quantity | Confirm dispatch/count | Mouser DE indexed 175; confirm current dispatch |
| Board supply / logic | 3.3 V | 3.3 V |
| Connection | 2× Qwiic; UART pads | 2× Qwiic; UART pads |
| I²C address | `0x42` | `0x42`; test separately or reconfigure |
| Antenna | External SMA, separately specified | Built-in antenna; no separate antenna cable |
| Board footprint | See existing MAX-M10S drawing | 40.64 × 40.64 mm; four mounting holes |
| Backup supply | See selected board BOM | Onboard rechargeable lithium backup cell; include in assembly evidence |
| Installation tradeoff | Flexible antenna placement | Board location/orientation controls reception |
| Board RoHS | Yes, supplier declaration | Yes, supplier declaration |
| Board temperature / current | Not yet qualified | Not yet qualified |
| Multiyear supply commitment | Not obtained | Not obtained |
| Deciding test | Enclosed reception with chosen antenna | Enclosed reception at feasible mounting location |

[SparkFun's SAM-M10Q hardware guide][sam-guide] supplies the wiring and antenna arrangement. The [Mouser listing][sam-price] is a secondary price/stock snapshot, not the purchasing declaration used above. Re-quote from the intended supplier. The existing [GNSS comparison](GNSS.md) retains v1 and historical alternatives. **LC76G purchases are on hold until exact-board RoHS evidence is obtained.**

## Additional IMU candidate

**SparkFun SEN-22857 BNO086** offers nine-axis fusion and fitted Qwiic connectors. Its [manufacturer hookup guide][bno-guide] requires **INT and RST in addition to Qwiic** for reliable operation with the documented library. Qwiic alone is not the recommended assembly. This is a conditional alternative, not a drop-in replacement for Adafruit 4754.

| Criterion | Adafruit 4754 BNO085 | SparkFun SEN-22857 BNO086 |
| --- | --- | --- |
| Decision | Retain, subject to shared-bus test | Hold for auxiliary-pin allocation |
| EUR net price | €25.97 Botland listing | €41.58 Botland listing |
| EU seller | [Botland][imu] | [Botland][bno-buy] |
| US manufacturer | [Adafruit][imu-us] | [SparkFun][bno-us] |
| Stock | Confirm dispatch; listing includes incoming 40 | Count/dispatch unconfirmed |
| Supply | 3–5 V VIN; 3.3 V QT | 2.4–3.6 V; use 3.3 V |
| Data | I²C / SPI / UART | I²C / SPI / UART |
| Assembly | QT; qualify recovery requirements | ▼ QT + prepared INT/RST connections |
| Board RoHS | Yes, supplier declaration | Yes, supplier declaration |
| Lifecycle evidence | Product history since 2020 | Named successor to SparkFun BNO080 board¹ |
| Board temperature / configured current | Not yet qualified | Not yet qualified |
| Deciding test | ESP32-S3 bus reliability | Pin budget, bus reliability, installed heading |

¹ SparkFun's [SEN-14686 discontinuation notice][bno-pcn] names SEN-22857 as the replacement. This demonstrates an actual predecessor/replacement path, not a promised future lifetime. Hardware and library licenses must be captured at the selected revisions before reuse; no claim of better sailing accuracy follows from the newer IC.

## Additional pressure candidate

**SparkFun SEN-20170 BMP581** provides a Qwiic alternative if BMP390 board supply cannot be secured. It retains the protected enclosure vent requirement; a different pressure IC cannot solve a sealed or water-blocked pressure path.

| Criterion | Adafruit 4816 BMP390 | SparkFun SEN-20170 BMP581 |
| --- | --- | --- |
| Decision | Existing candidate; supply gate | **★ Additional supply candidate** |
| EUR price evidence | €9.96 net US equivalent | €20.88 net US equivalent |
| EU seller / RoHS | [Botland][bmp] | [Botland][pressure] |
| US seller | [Adafruit][bmp-us] | [SparkFun][pressure-us] |
| Availability evidence | Multiple unavailable listings; Botland catalogue also says withdrawn | Manufacturer lists in stock; EU delivery needs confirmation |
| Qwiic supply | 3.3 V | 3.3 V |
| I²C addresses | `0x77` / `0x76` | `0x47` / `0x46` |
| Interfaces | I²C / SPI | I²C / SPI |
| Board RoHS | Yes, supplier declaration | Yes, supplier declaration |
| Assembly | Fitted QT; protected pressure path | Fitted Qwiic; same pressure-path requirement |
| Migration | Planned BMP3xx driver | Different driver and configuration |
| Deciding test | Supply + vent response | Supply + vent response; no accuracy winner assigned |

Source: [SparkFun board/guide][pressure-us]. Manufacturer price US$22.95 converted using the register's 2026-11-17 rate (€1 = US$1.0989). Board prices exclude cable, vent, shipping and assembly. A reseller withdrawing 4816 does not establish manufacturer EOL; confirm it before substituting.

## Unresolved production blockers

- **RLCD controller:** no exact-board RoHS declaration or complete-board EU conformity record was found in the reviewed Waveshare documentation. The ESP32 module's approvals do not cover the display board. Obtain that evidence before committing to a production-intent controller order or carrier layout. Existing PoC use remains a reference.
- **Wind head and RS485:** exact wind model and whole sensor evidence are missing. The generic v1 converter is a reference, not a production selection. Olimex's declared RS485 board still needs protocol compatibility review.
- **Network power, battery, antenna and assembly materials:** exact parts and their applicable evidence remain unresolved. Include the carrier, solder, headers, cables, seals and enclosure materials in the procurement record.
- **Continuity:** obtain quantity/lead-time quotes, PCB revision identification, substitution controls and change/EOL notification terms. Stock snapshots and open designs do not guarantee continuing supply.

The next production-intent GNSS comparison is **MAX-M10S versus SAM-M10Q**, using a documented supplier route. Keep Adafruit BNO085 as the IMU candidate; do not add BNO086 until its extra signals fit. Obtain a sustainable BMP390 quote or qualify BMP581. The complete v2 BOM remains unreleased until the controller and remaining procurement gates close.

[max]: https://botland.store/gps-modules/22065-gnss-max-m10s-module-qwiic-sparkfun-gps-18037.html
[sam]: https://botland.store/gps-modules/23040-sparkfun-gps-breakout-gps-module-with-sam-m10q-chip-and-antena-qwiic-sparkfun-gps-21834.html
[imu]: https://botland.store/9dof-imu-sensors/22113-bno085-9-dof-imu-fusion-breakout-3-axis-accelerometer-magnetometer-and-gyroscope-adafruit-4754.html
[bno]: https://botland.de/9dof-imu-sensoren/23839-vr-imu-breakout-vr-modul-mit-imu-sensor-bno086-qwiic-sparkfun-sen-22857.html
[bmp]: https://botland.de/drucksensor/19003-bmp390l-druck-und-temperatursensor-stemma-qt-qwiic-adafruit-4816-5904422354640.html
[pressure]: https://botland.store/pressure-sensors/21820-air-pressure-sensor-barometer-30-125kpa-bmp581-qwiic-sparkfun-sen-20170.html
[light]: https://botland.cz/svetelne-a-barevne-senzory/23550-veml7700-senzor-intenzity-svetla-i2c-stemma-qt-qwiic-adafruit-4162.html
[boost]: https://botland.store/converters-step-up/1893-step-up-voltage-regulator-u1v11f5-5v-12a-pololu-2562-5904422308230.html
[can-doc]: https://www.olimex.com/Products/OLinuXino/A20/A20-CAN/resources/EU-DOC-A20-CAN.pdf
[rs-doc]: https://www.olimex.com/Products/Modules/Interface/MOD-RS485-ISO/resources/EU-DOC-MOD-RS485-ISO.pdf
[ada-support]: https://forums.adafruit.com/viewtopic.php?t=223024
[max-us]: https://www.sparkfun.com/sparkfun-gnss-receiver-breakout-max-m10s-qwiic.html
[sam-us]: https://www.sparkfun.com/sparkfun-gps-breakout-chip-antenna-sam-m10q-qwiic.html
[sam-guide]: https://docs.sparkfun.com/SparkFun_u-blox_SAM-M10Q/hardware_overview/
[sam-price]: https://www.mouser.de/en/ProductDetail/SparkFun/GPS-21834?qs=sGAEpiMZZMu4bqlooK2Tua6fb7iZCjNZTgnju8BZPYd1WSYZgB2xVg%3D%3D
[bno-guide]: https://docs.sparkfun.com/SparkFun_VR_IMU_Breakout_BNO086_QWIIC/hardware_hookup/
[bno-buy]: https://botland.store/9dof-imu-sensors/23839-vr-imu-breakout-vr-module-with-imu-sensor-bno086-qwiic-sparkfun-sen-22857.html
[imu-us]: https://www.adafruit.com/product/4754
[bno-us]: https://www.sparkfun.com/sparkfun-vr-imu-breakout-bno086-qwiic.html
[bno-pcn]: https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/5560/EOL_SEN-14686.pdf
[bmp-us]: https://www.adafruit.com/product/4816
[pressure-us]: https://www.sparkfun.com/sparkfun-pressure-sensor-bmp581-qwiic.html?___store=default
