# Heading and attitude IMU decision

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Supplier register](SOURCING_AND_EVIDENCE.md)

## Decision

Use **Adafruit 4754 BNO085** as the preferred new-build prototype candidate, while retaining the working BNO080 board as a reference. It provides fused nine-axis orientation and fitted STEMMA QT connections at a lower board price than Smart DOF 4 Click. The decisive open issue is reliable operation on ESP32-S3 I²C, not the number of axes.

## Comparison

| Candidate | Function and interface | Electrical / temperature | Assembly and cost consequence | Disposition |
| --- | --- | --- | --- | --- |
| Existing v1 BNO080-family breakout | Working fusion for heading, heel and pitch; I²C | Exact breakout input/current/rating unrecorded; identify actual IC and pull-ups | Already owned; no assumed native QT connector | Mandatory regression reference; do not replace solely because telemetry was slow |
| Adafruit 4754 BNO085 | Nine-axis sensor plus onboard fusion; QT I²C, UART/SPI pads | Board VIN 3–5 V; use 3.3 V QT. Default `0x4A`, alternate `0x4B`; 10 kΩ pull-ups. IC −40…+85 °C; complete-board limit unconfirmed | Assembled QT connectors and mounting holes; US$29.50 snapshot | Preferred prototype, conditional on bus tests |
| MikroE MIKROE-6369 Smart DOF 4 Click | BNO085; mikroBUS and ClickID | 3.3 V; same sensor family, no proven measurement improvement; whole-board current/temp unqualified | SPI default; I²C requires solder-jumper configuration. No QT. Price premium buys board/ecosystem features | Not preferred; only reconsider for a deliberate mikroBUS carrier |
| Unspecified raw accelerometer/gyro/magnetometer board | May provide nine axes without equivalent fusion/calibration | Depends on exact parts | Host fusion, calibration and validation work would increase | No exact candidate selected; not a procurement substitute |

BNO08x current depends strongly on reports and rates. The [BNO080/085 datasheet in the repository](../../../firmware/include/BNO080_085-Datasheet_v1.16.md) gives, for example, about 35 mW for BNO085 100 Hz fusion under its SPI/rail conditions. This is not a measured QT board current. Log total 3.3 V branch current and startup peaks with the reports Veetr actually uses.

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
