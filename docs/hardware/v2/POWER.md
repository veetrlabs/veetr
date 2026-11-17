# Battery and 5 V power decision

[Decision overview](../../RLCD_V2_HARDWARE.md) · [Canonical specification](../../ESP32-S3-RLCD-4.2.md) · [Order and tests](PROTOTYPE_ORDER.md)

## Decision

The wind head needs **regulated 5 V on battery**, while Waveshare P1 VBUS is supplied by USB. Evaluate **Pololu U1V11F5, item 2562**, first for the wind load. Keep **Pololu S13V20F5, item 4085**, as a higher-load comparison for CAN or a combined 5 V branch. Neither is a final selection until startup current, minimum battery voltage and thermal margin are measured.

The intended path is protected, switched battery → regulator → local 5 V loads. P1 does not expose that battery node. A carrier power path or qualified battery adapter must preserve protection, cutoff, switching and charger behavior. That connection is a design blocker for an unattended battery prototype, not a jumper to improvise from USB VBUS.

## NMEA2000 power and first-carrier provision

**Network-powered operation is a v2 prototype requirement.** A powered NMEA2000 cable should run the controller, fitted sensors, wind head and display without USB. Battery charging is allowed within a defined total input-current budget. The first PCB must support this architecture even if the isolated power module is populated in a later build.

The network has a nominal 12 V supply; design operation across 9–16 V at the device input. Network consumption is declared in load-equivalency units (LEN), with 1 LEN representing 50 mA. Establish the applicable declaration and installation budget from worst-case input consumption, including charging and conversion losses, rather than from a typical 5 V load. See [Garmin's NMEA2000 reference](https://www8.garmin.com/manuals/webhelp/GUID-1415AAD0-FE63-42A6-8F8D-DB713D616122/EN-GB/GUID-9C47C97C-88A2-4EC6-9846-9B6937C3ACA7.html). Protection against transients is a separate requirement from the normal operating-voltage range.

Intended path: NET-S/NET-C → input protection and current limiting → isolated DC/DC → local regulated 5 V → source selection → system loads and qualified battery charger. USB is the other external source. The protected battery and boost supply the loads when external power is absent. The battery-derived rail must not feed its own charger input.

| Supply state | Required behavior |
| --- | --- |
| Powered NMEA cable only | Run all configured loads; charge only within the network current budget; reduce/pause charging before compromising operation |
| USB only | Run and charge within the available USB input budget |
| Both present | Deterministic automatic source selection, no reverse current into USB or the backbone; record source priority in the circuit specification |
| Neither present | Continue on protected battery, including wind 5 V; no output onto network power pins |
| Network power option unpopulated | Operate from USB/battery; NET-S has no path to local supply; CAN data interface can still be qualified independently |

### Required provisions on the first carrier

| Provision | Must be resolved before PCB fabrication |
| --- | --- |
| Network connector routing | Bring NET-S and NET-C to the input area; keep network reference, local ground and shield treatment explicit. Avoid a shared-ground bypass around CAN or power isolation |
| Input protection | Define reverse-polarity, overcurrent/inrush and transient protection; provide an independently disconnectable network-power branch |
| Converter accommodation | Select a converter footprint **or** a fixed keyed daughterboard interface carrying network input and isolated local output; reserve mounting, height, thermal space and insulation clearances for the selected implementation |
| Source selection | Reserve and design the USB/network selection and reverse-current blocking. An empty converter footprint alone does not make the board ready |
| Waveshare interface | Resolve USB VBUS, system feed and charger interaction against the actual board schematic. An input diode on the network branch alone cannot prevent it feeding the board's USB connector |
| Battery and charging | Preserve cell protection/cutoff; define charging limit and load priority. Demonstrate that the board charger is compatible, or select a separate managed path |
| Battery boost | Prevent external supplies and battery-derived 5 V from driving one another; prevent a boost-to-charger loop |
| Assembly variants | Document populated and unpopulated BOMs, isolation boundary and safe link states; no loose live network-power lead in the first build |
| Test access and placement | Provide labeled input/output test points on their respective domains; keep switching components away from the IMU and antenna and allow thermal measurements |

The [Waveshare schematic](https://files.waveshare.com/wiki/ESP32-S3-RLCD-4.2/ESP32-S3-RLCD-4.2-schematic.pdf) exposes VBUS shared with USB and the charging circuit. Decide how both external supplies reach this node safely, including whether the carrier must manage the USB power connection. Do not assume an unmodified onboard USB port can coexist with power injected at P1.

No network converter, source-selector or protection SKU is selected yet. Prefer a ready-made isolated module with a documented pin/header interface, credible supplier evidence and adequate low-input-voltage output. The Pololu 2562 and 4085 remain local conversion candidates; neither provides the isolation required for this network-power input. The existing CAN module's isolated converter powers its own bus side and is not a supply for the whole instrument.

### Staged implementation

The first bench assembly may use USB/battery and leave the network-power module absent. Its carrier still requires the provisions above and a reviewed upgrade assembly drawing. A subsequent assembly can populate the module/protection option and complete power tests without changing the carrier PCB. If no safe fixed interface can be specified before layout, carrier fabrication remains blocked; an unspecified rectangle is not a qualified upgrade provision.

## Comparison

| Candidate | Input → output | Current / efficiency evidence | Assembly and gaps | Disposition |
| --- | --- | --- | --- | --- |
| USB VBUS, current PoC | USB 5 V → wind 5 V | No battery conversion | Existing connection works with USB present | Bench baseline; does not meet battery-only requirement |
| Pololu 2562 U1V11F5 | 0.5–5.5 V → 5 V, ±4% | 1.2 A is input/switch capability, not guaranteed 5 V output; use output curves. Typical idle below 1 mA, true shutdown; 70–90% efficiency range | 2.54 mm holes; assembler fits headers. No lithium undervoltage cutoff or reverse-polarity protection; whole-board thermal qualification open | First wind evaluation candidate |
| Pololu 4085 S13V20F5 | 2.8–22 V → 5 V | Advertised 2 A depends on input/thermal conditions; typical 10–20 mA no-load penalty | 2.54 mm holes; no reverse-voltage protection; no enable input | Higher-load CAN/combined-rail comparison, not automatically needed alongside 2562 |
| Unspecified high-current boost / custom converter | Depends on measured requirements | No exact part selected | Adds design/qualification work | Select only if measured load excludes the ready-made candidates |

Manufacturer evidence: [2562](https://www.pololu.com/product/2562), [4085](https://www.pololu.com/product/4085). Both are listed Active and Preferred; this is not a guaranteed delivery period. Their published curves are more useful than a single headline amp rating. No complete-board ambient operating range or Veetr-enclosed thermal margin has been established here.

## Rail budget to measure

| Load | Supply domain | Evidence available | Measurement required |
| --- | --- | --- | --- |
| RLCD controller, display, onboard peripherals | Board battery/USB path and 3.3 V | Current is workload-dependent | Idle, display updates, radio bursts, startup and sleep/off leakage |
| GNSS and active antenna | Local 3.3 V branch | Module datasheets; [GNSS comparison](GNSS.md) | Full board + antenna acquisition/tracking/startup at selected rates |
| IMU and optional I²C sensors | Local 3.3 V | Mode-dependent IC figures | Actual branch draw and bus pull-up load |
| Wind head | Regulated 5 V at the head | 5 V required in PoC; exact model running/start current unrecorded | Startup, sustained draw and cable-end minimum voltage |
| CAN module | Local 5 V plus 3.3 V logic; isolated converter downstream | Required rails known | Idle/traffic peaks and isolated-side voltage |
| Battery charging | Selected external supply through qualified charger | Charge setting and input budget unresolved | Worst input draw with depleted cell and concurrent full system load; current limiting and thermal behavior |
| Network power stage | NET-S/NET-C through isolated conversion | Nominal 12 V, 9–16 V operating target | Idle/inrush/full-load current across input range, efficiency, thermal margin and reverse current |
| SD | Onboard regulated rail | Write peaks not measured | Worst write/flush peak and brownout behavior |
| Front-light | Driver-dependent | LED/driver not yet selected | Minimum readable brightness through maximum permitted setting |

The v1 whole-device 200/400 mA estimates cannot fill individual rows. Measure rail peaks simultaneously; do not sum unrelated typical values and treat the result as a safe maximum. Define a load margin after observing startup and low-battery behavior.

For scale only, a 0.1 A wind load at 5 V would draw approximately 0.159 A from a 3.7 V battery at 85% conversion efficiency, before other loads: `I_battery = V_out × I_out / (V_battery × efficiency)`. Runtime must use measured average power and usable battery energy through cutoff, including temperature and aging margin.

## Integration requirements

Keep boost output separate from USB VBUS. A 3.3 V-fed boost is a bench option only after establishing Waveshare regulator margin; it incurs another conversion stage. It is not the selected battery connection. Do not connect a converter directly to raw cells while bypassing pack protection.

A single converter may serve wind and the local side of CAN if combined startup/noise tests pass and grounds belong to the same domain. An isolated RS485 upgrade may require a different sensor power arrangement; see [marine interfaces](INTERFACES.md). Do not buy two converters as a permanent requirement before measuring the load.

The exact cell SKU, connector polarity, mechanical fit, charger compatibility, charge/discharge temperature limits, protection and UN38.3 transport evidence remain open. The usable product temperature range must respect the battery and display, not merely the ESP32 or GNSS rating. The specified external boat supply is the powered NMEA2000 network through the protected isolated input. A separate raw 12/24 V boat-power input is outside this design.

## Acceptance

With network power fitted, test 9–16 V operation, depleted-battery charging plus full load, input current limiting, hot-plug/inrush and all four source states above. Verify no reverse current into USB or NET-S, no battery-to-charger loop, preservation of the isolation boundary and uninterrupted sensor/logging behavior during source transitions. Record maximum network draw and the declared LEN before boat-network use. Transient, EMC and insulation qualification require the final circuit and defined test criteria.

Record wind startup at minimum battery voltage, all-load peaks, converter temperature, output ripple and cable-end voltage. Repeat with SD writes, both radios, CAN traffic and lighting. Verify heading with the converter running. Test USB removal/reconnection, charging transitions, low-battery cutoff, off-state drain and recovery without corrupting logs or losing wind acquisition.

The winner is the lowest installed-cost converter/power-path combination that passes those tests with margin. Converter price, header assembly and protection components belong in the total. Supplier links, current prices and license/compliance gaps are in the [supplier register](SOURCING_AND_EVIDENCE.md).
