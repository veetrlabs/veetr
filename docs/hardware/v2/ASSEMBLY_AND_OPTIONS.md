# Assembly, optional sensors and enclosure decisions

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Order plan](PROTOTYPE_ORDER.md)

## I²C interconnect decision

Use short **Qwiic/STEMMA QT cables** in the next prototype. SparkFun GPS-18037 and Adafruit 4754 connect directly using fitted connectors. A single custom carrier supplies the shared 3.3 V bus. No individual adapter PCB or identification EEPROM is required for these two boards.

| Option | Assembly and service | Mechanical consequence | Decision |
| --- | --- | --- | --- |
| Qwiic/QT cables | No sensor header soldering; replace a board by unplugging a cable | Each board still needs support; retain cables against vibration and chafing | Prototype choice; three short sensor cables initially |
| Board-specific header sockets | Compact mating assembly; assembler fits headers | Still requires exact footprint, height, orientation and mounting support for each board | Compare assembly time and retention before final carrier freeze |
| mikroBUS / ClickID | Common socket form and supported board identification | Larger standard footprint and more expensive modules; not all boards fit the required signals/configuration | Premium not justified for this prototype |
| Own adapters with ID EEPROM | Could normalize arbitrary boards and encode part/revision | Adapter PCB, EEPROM programming, soldering and stock tracking for each type | Rejected for present scale and cost goal |

Two connectors on a Qwiic/QT board normally expose the same power and bus signals for chaining. They are not independent buses or mechanically supporting sockets. Start with separate short carrier cables for GNSS, IMU and BMP390; lighting modules may need additional ports or a documented chain. Keep connections inside the sealed enclosure; QT is not a waterproof or marine vibration rating.

Use the [standard connector pin convention][qt-spec] and only electrically compatible 3.3 V modules. Protocol-specific product identification can identify a supported chip, but an I²C address alone cannot identify a board or its physical socket. Duplicate addresses, voltage compatibility and pull-ups still matter. Connect modules with power off.

## Mounting and enclosure

Mount boards on a removable internal tray or board-specific standoffs, independent of cable retention. Final material, hole pattern and fastener sizes follow actual sample dimensions and enclosure CAD; they are not yet an order-ready PCB drawing. A shared hole grid may ease changes, but does not make unequal board footprints interchangeable.

Compare two real assemblies: cable-connected boards on standoffs, and assembler-fitted headers into carrier sockets. Record assembly minutes, solder operations, rework access, connector retention, height and vibration behavior. Choose after that comparison rather than adding per-module adapter boards solely to make footprints equal.

Every exterior face can receive waves, rain and wind. Design sealing and cable entries for that exposure; do not assume there is a permanently sheltered underside. Specify strain relief, corrosion resistance, gasket compression, condensation control and antenna clearances. Waterproofness and serviceability must be demonstrated on the complete closed assembly.

## Optional local sensors and network sources

GNSS, IMU and pressure can be optional when configured NMEA2000 sources provide equivalent data. The firmware needs an explicit source policy, freshness timeout, missing-module behavior and fallback only where another valid source exists. A heading PGN does not guarantee heel/pitch, and network failure must leave unavailable fields clearly marked. See [network scope](INTERFACES.md#nmea2000-feature-scope).

## Night readability

The reflective panel needs **front illumination** in darkness. Evaluate low-level bezel LEDs or a front-light guide inside the sealed display window. This is an optical/mechanical experiment; no LED part, driver, GPIO or final current budget has been selected.

| Candidate / approach | Supply, current and temperature evidence | Benefit / limitation | Decision |
| --- | --- | --- | --- |
| Adafruit 4162 VEML7700 QT ambient sensor | Breakout supports 3–5 V; use 3.3 V bus, address `0x10`. Exact configured board draw and complete-board temperature limit not established | Native QT, inexpensive, digital ambient measurement | Optional prototype sensor for Auto mode |
| Manual dimming only | LED driver determines load and limits | Simpler, no ambient feedback loop; user must adjust | Required manual control/fallback even with ambient sensor |
| Bezel LEDs / front-light guide | Driver, current and temperature not selected | Can illuminate panel but may create glare or uneven light | Optical comparison required before ordering final carrier |
| Different illuminated display | Complete alternative BOM required | May solve night optics but changes power and outdoor readability | Reconsider only if front illumination cannot meet tests |

Provide Auto / Off / On and manual brightness. In Auto, use hysteresis and delay so brief shadows or reflections do not cause flicker. Place the ambient sensor behind a suitable optical window and shield it from the instrument's own LEDs; otherwise the light can repeatedly switch itself. Test through a wet window, in darkness and sunlight, across viewing angles, and with other boat lights present. Include illumination in runtime and IMU interference tests.

Source: [Adafruit VEML7700 board](https://www.adafruit.com/product/4162) and [guide](https://learn.adafruit.com/adafruit-veml7700/pinouts). Current supply status and price are in the [supplier register](SOURCING_AND_EVIDENCE.md).

## Barometer and protected pressure vent

**Include local atmospheric pressure in the prototype:** Adafruit 4816 BMP390 QT inside the enclosure, with a replaceable water-barrier pressure vent and an external recessed splash shield. Users may still omit the sensor when using a configured NMEA pressure source. The enclosure vent is part of the prototype design even if sensor delivery is delayed.

### Selected prototype parts

Use **BOPLA DAE M12 9005, part 52042000**, as the first vent candidate: black nylon, M12 × 1.5 thread, supplied O-ring and oleophobic membrane. BOPLA documents typical airflow of 400 ml/min at 70 mbar and IP66/67/68/69K laboratory tests; its IP68 condition is 2 m freshwater immersion for 60 minutes. Those component tests do not establish saltwater performance or an IP rating for the printed enclosure. Follow the installation drawing, sealing surface and torque instructions; BOPLA calls for a counter nut with walls thinner than 3 mm. [Manufacturer technical information](https://www.bopla.de/fileadmin/product_data/_Product_Information/52042000_DAE-M12-Technical-Information-EN.pdf)

The high-pressure airflow figure does not establish response to small atmospheric changes. Measure lag using the actual enclosure volume, vent, splash shield and mounting orientation. A membrane covered by water or salt may delay pressure equalization even when it prevents ingress.

| Approach | Benefit / limitation | Decision |
| --- | --- | --- |
| BMP390 + BOPLA 52042000 + draining splash shield | Replaceable threaded water barrier; concrete EU sourcing; enclosure can exchange air | Selected prototype approach, pending ingress and pressure-response tests |
| GORE PolyVent screw-in family | Hydrophobic/oleophobic vent options and documented installation guidance | Alternative if the BOPLA assembly fails size, response or exposure tests; exact SKU not selected. [Manufacturer](https://www.gore.com/gorer-protective-vents-screw-series) |
| Bare adhesive membrane | Compact but assembly depends on adhesive, surface preparation and protection | Not preferred for the first serviceable printed enclosure |
| Airtight enclosure with internal sensor | Measures trapped air and temperature/flex effects | Not suitable for the intended atmospheric measurement |
| NMEA pressure | No local sensor required; useful comparison/fallback when available | Retain selectable network source |

### Splash-shield geometry

The shield is a proposed enclosure feature, not a demonstrated splash-proof rating. All exterior faces remain wave-exposed.

- Recess the vent behind a hood/baffle with an indirect air path, so spray has no straight path to the vent face. Keep clearance around its air openings.
- Place the vent above the floor of the exterior recess. Provide generous open drains and exits for the intended installation and expected heel angles; avoid pockets, capillary gaps or narrow passages that retain water and salt.
- Keep every drain on the **outside** of the membrane and its O-ring seal. The only pressure path into the electronics cavity passes through the vent; drain holes must not bypass the water barrier.
- Provide a flat, durable O-ring sealing land and adequate wall support. Validate surface finishing and porosity of the printed enclosure; tightening a vent into a rough print does not establish a seal.
- Make the hood and vent accessible for inspection, rinsing and replacement. Do not add absorbent foam or coat/glue the membrane. Keep the internal pressure path open to the sensor.
- Avoid locating the recess where wind creates a strong ram-pressure or suction effect. Compare sheltered reference pressure against different wind directions, heel angles and wave exposure.

Build a representative enclosure-wall coupon with the same material, finish, vent seat, wall thickness, hood and drains before committing the final enclosure. A shield should reduce direct wetting; qualification must also cover a fully wetted vent and temporary flooding of the recess.

### Sensor and assembly

The BMP390 breakout accepts 3–5 V; use 3.3 V QT, normally `0x77` (`0x76` alternative). Bosch gives the IC −40…+85 °C operation and mode-dependent microamp consumption; that is not a complete-board or enclosure rating. Measure configured board current and locate it away from converter/charger heating. Keep its pressure port clear of sealant, coating and liquid. Sources: [Bosch specifications](https://www.bosch-sensortec.com/products/environmental-sensors/pressure-sensors/bmp390/), [Adafruit pinout](https://learn.adafruit.com/adafruit-bmp388-bmp390-bmp3xx/pinouts).

Provide a third short QT connection or a documented chain, and include its pull-ups in the bus review. The [order plan](PROTOTYPE_ORDER.md) includes one sensor, a five-vent pack for the unit and test coupons/spares, the mating hardware and the splash-shield prototype. Sensor stock and final mounting hardware remain procurement checks, not a reason to defer the design.

### Pressure and ingress acceptance

Record pressure against a sheltered external reference before exposure, during changes in internal temperature and airflow, and after freshwater spray, salt exposure, recess flooding and drying. Measure offset, response lag and recovery time, alongside inspection for internal moisture. Test intended mounting and heel angles. Establish allowable pressure error and trend-response time before the campaign; until demonstrated, do not claim reliable atmospheric readings during wetting or immersion. A responsive sensor cannot identify a blocked vent by itself.

## License and release gate

Inspect the exact revision's hardware files and host-library licenses for optional Adafruit boards before copying designs or adding dependencies; these have not been frozen in the Veetr BOM. A published schematic is useful evidence but is separate from CE/FCC, waterproofness and lifecycle commitments. [Compliance status](../../COMPLIANCE.md) records the assembled product's current evidence.

Promote options only after mechanical retention, wet/night readability, magnetic interference and power tests pass. Local barometry additionally requires an atmospheric response test after the enclosure exposure sequence. Freeze the final mounting approach, connectors and driver signals in the canonical specification before PCB manufacture.

[qt-spec]: https://learn.adafruit.com/introducing-adafruit-stemma-qt/technical-specs
