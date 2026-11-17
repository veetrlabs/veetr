# Assembly, optional sensors and enclosure decisions

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Order plan](PROTOTYPE_ORDER.md)

## I²C interconnect decision

Use short **Qwiic/STEMMA QT cables** in the next prototype. SparkFun GPS-18037 and Adafruit 4754 connect directly using fitted connectors. A single custom carrier supplies the shared 3.3 V bus. No individual adapter PCB or identification EEPROM is required for these two boards.

**★** = best documented fit for the row; **▼** = disadvantage for this v2 design; **?** = not established. Unmarked values are neutral or not directly comparable. Unknown evidence is not a failure.

Prices are **EUR excluding VAT**, unless marked otherwise. See the [supplier register](SOURCING_AND_EVIDENCE.md#price-and-quantity-snapshot) for dated quotes, conversions and stock. “Yes” in a compliance row applies only to the stated board, not the assembled Veetr product.

| Criterion | Qwiic / STEMMA QT | Board-specific headers | mikroBUS / ClickID | Own EEPROM adapters |
| --- | --- | --- | --- | --- |
| **Decision** | **★ Prototype choice** | Assembly comparison | ▼ Premium not justified | ▼ Outside BOM |
| **Sensor soldering** | **★ None with fitted QT** | Fit headers | Depends on board/jumpers | ▼ Per-board assembly |
| Carrier work | Shared 3.3 V bus ports | Specific footprints | Standard socket footprint | ▼ Adapter design per board |
| Identification | Supported chip protocol | Supported chip protocol | **★ ClickID where supported** | EEPROM programming |
| Board mounting | Tray or standoffs | Footprint and supports | Larger standard footprint | Adapter plus supports |
| Service | Unplug cable | Unplug board | Unplug board | Track board/adapter pairing |
| Cost consequence | Cables and retention | Headers and assembly labour | ▼ Higher module prices | ▼ PCB, EEPROM and labour |
| Deciding test | Retention and assembly time | Height and assembly time | Installed cost | No benefit at current scale |

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

### Optional sensor boards

These boards serve different functions; neither replaces the other. V1 has neither feature, so there is no tested v1 sensor to price or rank.

| Criterion | Ambient light: Adafruit VEML7700 | Pressure: Adafruit BMP390 |
| --- | --- | --- |
| **Decision** | Optional Auto-light experiment | Included in prototype |
| Board | 4162 | 4816 |
| **Price, EUR net** | €4.50 US equivalent | €9.96 US equivalent |
| **EU seller** | ? | [BerryBase][bmp-eu] |
| **US seller** | [Adafruit][light-buy] | [Adafruit][bmp-buy] |
| **Listed stock** | US 42 | EU / US unavailable |
| Supply commitment | ? | ? |
| **Quality evidence** | Published board guide | Board guide + Bosch datasheet |
| **Features** | Digital ambient light | Atmospheric pressure / altitude |
| **Board voltage** | 3–5 V; use 3.3 V QT | 3–5 V; use 3.3 V QT |
| **Configured board current** | ? | ? |
| **Operating temperature, IC** | ? | −40…+85 °C |
| **Connections** | STEMMA QT / I²C | STEMMA QT / I²C |
| I²C address | `0x10` | `0x77` / `0x76` |
| **Assembly** | Direct cable; optical window | Direct cable; protected air path |
| **CE / EU DoC — board** | Unknown | Unknown |
| **RoHS — board** | [**Yes — supplier declaration**](https://botland.cz/svetelne-a-barevne-senzory/23550-veml7700-senzor-intenzity-svetla-i2c-stemma-qt-qwiic-adafruit-4162.html) | [**Yes — supplier declaration**](https://botland.de/drucksensor/19003-bmp390l-druck-und-temperatursensor-stemma-qt-qwiic-adafruit-4816-5904422354640.html) |
| **REACH / FCC — board** | Unknown / Unknown | Unknown / Unknown |
| **Hardware / library license** | Exact revision to verify | Exact revision to verify |
| Deciding test | Self-light rejection and hysteresis | Pressure lag after wetting |

Full-board temperature limits and current at Veetr’s configured sampling rates remain open for both. BMP390’s EU quote is €10.50 including VAT; the net comparison above uses the US quote. No performance winner is assigned across different sensor functions.

### Lighting alternatives

| Criterion | Bezel LEDs / front-light guide | Different illuminated display |
| --- | --- | --- |
| **Decision** | **★ First optical experiment** | Fallback if optics fail |
| Existing RLCD | **★ Retained** | ▼ Replaced |
| Parts / price | LED and driver selection pending | Complete BOM needed |
| Supply / current / temperature | Driver and optics dependent | Display dependent |
| Main tradeoff | Glare and light uniformity | Power and outdoor readability |
| Deciding test | Wet-window night visibility | Outdoor visibility and runtime |

Manual dimming remains a required control alongside optional ambient sensing.

Provide Auto / Off / On and manual brightness. In Auto, use hysteresis and delay so brief shadows or reflections do not cause flicker. Place the ambient sensor behind a suitable optical window and shield it from the instrument's own LEDs; otherwise the light can repeatedly switch itself. Test through a wet window, in darkness and sunlight, across viewing angles, and with other boat lights present. Include illumination in runtime and IMU interference tests.

Source: [Adafruit VEML7700 board](https://www.adafruit.com/product/4162) and [guide](https://learn.adafruit.com/adafruit-veml7700/pinouts). Current supply status and price are in the [supplier register](SOURCING_AND_EVIDENCE.md).

## Barometer and protected pressure vent

**Include local atmospheric pressure in the prototype:** Adafruit 4816 BMP390 QT inside the enclosure, with a replaceable water-barrier pressure vent and an external recessed splash shield. Users may still omit the sensor when using a configured NMEA pressure source. The enclosure vent is part of the prototype design even if sensor delivery is delayed.

The [production selection](PRODUCTION_SELECTION.md#additional-pressure-candidate) adds SparkFun SEN-20170 BMP581 as a documented Qwiic supply alternative. Confirm continuing BMP390 supply before ordering; no automatic sensor substitution is specified.

### Selected prototype parts

Use **BOPLA DAE M12 9005, part 52042000**, as the first vent candidate: black nylon, M12 × 1.5 thread, supplied O-ring and oleophobic membrane. BOPLA documents typical airflow of 400 ml/min at 70 mbar and IP66/67/68/69K laboratory tests; its IP68 condition is 2 m freshwater immersion for 60 minutes. Those component tests do not establish saltwater performance or an IP rating for the printed enclosure. Follow the installation drawing, sealing surface and torque instructions; BOPLA calls for a counter nut with walls thinner than 3 mm. [Manufacturer technical information](https://www.bopla.de/fileadmin/product_data/_Product_Information/52042000_DAE-M12-Technical-Information-EN.pdf)

The high-pressure airflow figure does not establish response to small atmospheric changes. Measure lag using the actual enclosure volume, vent, splash shield and mounting orientation. A membrane covered by water or salt may delay pressure equalization even when it prevents ingress.

| Criterion | BOPLA DAE M12 9005 | GORE PolyVent screw-in | Bare adhesive membrane |
| --- | --- | --- | --- |
| **Decision** | **★ First vent candidate** | Alternative family | ▼ Not preferred |
| Exact part | 52042000 | ? | ? |
| **Price, EUR net** | ≈€32.27 / five-pack¹ | ? | ? |
| **EU seller** | [TME][vent-eu] | Exact SKU / quote needed | Exact SKU / quote needed |
| **US seller** | [TME US][vent-us] | Exact SKU / quote needed | Exact SKU / quote needed |
| **Listed stock** | Regional counts conflict¹ | ? | ? |
| Supply history | Documented in 2019 | Family catalogue | ? |
| **Quality evidence** | Component ingress test sheet | Manufacturer installation guidance | Depends on selected part |
| Water barrier | Oleophobic membrane + O-ring | Variant-dependent | Membrane + adhesive seal |
| Airflow | 400 ml/min at 70 mbar | SKU-dependent | SKU-dependent |
| Component IP tests | IP66/67/68/69K² | SKU-dependent | SKU-dependent |
| **Operating temperature** | Exact rating to verify | SKU-dependent | SKU-dependent |
| Voltage / current | Not applicable; passive | Not applicable; passive | Not applicable; passive |
| **Mounting** | M12 × 1.5; counter nut if wall <3 mm | SKU-dependent threaded fitting | ▼ Surface/adhesive preparation |
| **Service** | Replaceable threaded part | Replaceable threaded part | Adhesive removal/resealing |
| **RoHS / REACH evidence** | Unknown / Unknown | Exact SKU needed | Exact SKU needed |
| Design reuse license | ? | ? | ? |
| Deciding test | Installed seal and wet pressure lag | Fit and pressure lag if substituted | Bond durability and protection |

¹ Historical indexed quote converted using the register’s dated rate: ≈€6.45 per vent, minimum pack of five. Regional stock listings show 10/50 without a consistent unit basis; obtain a current quote. ² IP68 test: 2 m freshwater, 60 minutes; component result only. Passive vents have no electrical supply or radio module grant; product-level compliance depends on the completed enclosure.

An airtight box traps air and is unsuitable for local atmospheric measurement. A configured NMEA pressure source remains an alternative to fitting the local sensor. [GORE screw-in family](https://www.gore.com/gorer-protective-vents-screw-series) is the fallback if BOPLA fails fit or exposure tests.

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

[light-buy]: https://www.adafruit.com/product/4162
[bmp-buy]: https://www.adafruit.com/product/4816
[bmp-eu]: https://www.berrybase.de/adafruit-bmp390l-praezisions-druck-und-hoehenmesser-breakout-stemma-qt
[vent-eu]: https://www.tme.eu/en/details/dae-m12x1.5/enclosures-other-accessories/bopla/52042000/
[vent-us]: https://www.tme.com/us/en-us/details/dae-m12x1.5/enclosures-other-accessories/bopla/52042000/
