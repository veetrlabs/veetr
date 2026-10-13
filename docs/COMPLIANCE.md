---
title: Compliance and certifications
description: Module evidence and assembled-product compliance responsibilities for Veetr Vane.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/COMPLIANCE.md
---

Veetr's component choices do **not** establish certification of an assembled Veetr Vane. A radio module's approval, a component's isolation rating, or a supplier's material declaration covers a defined item and scope. The carrier PCB, enclosure, antennas, cables, power system and firmware must be considered in the finished product's assessment.

This page records engineering/procurement considerations, not an issued product declaration. The previous generic FCC/ISED compliance statements and blanket personal-use/low-power exemptions were not evidence for the completed product and must not be used as product labeling.

## Keep the two hardware generations separate

| Target | Radio module | Evidence to obtain for the actual assembly |
| --- | --- | --- |
| Original ESP32 prototype | ESP32-WROOM-32U | Exact module marking, current grants/DoC and antenna/integration conditions |
| Waveshare RLCD v2 proposal | ESP32-S3-WROOM-1-N16R8 in the reviewed schematic | WROOM-1 documents matching the installed module, plus Waveshare board evidence and host assessment |

Do not copy the original ESP32-WROOM-32U FCC/ISED identifiers onto an ESP32-S3 product. [Espressif's certificate catalogue](https://www.espressif.com/en/support/documents/certificates) lists WROOM-1 CE and FCC documents; an entry alone does not prove that a particular assembled unit meets its conditions. Match the module, antenna and configuration to the actual grant and integration instructions.

The [RLCD v2 hardware plan](RLCD_V2_HARDWARE.md) records the evidence found for concrete modules, EU suppliers, stock limitations and unresolved documentation requests.

## What the different documents mean

| Document / marking | Scope and limitation |
| --- | --- |
| **CE / EU Declaration of Conformity** | The manufacturer declares conformity of an identified product with applicable EU legislation. CE is not a general quality mark or necessarily a third-party certificate. The finished-product manufacturer remains responsible for conformity assessment, technical documentation and its own declaration. |
| **RoHS** | Restricts specified hazardous substances in electrical/electronic equipment. A supplier declaration helps material compliance; it does not demonstrate EMC, radio, ingress or marine reliability. |
| **REACH** | EU chemical/substance obligations, including applicable restrictions and substance communication. Obtain relevant current declarations for exact parts; it is not a radio certificate. |
| **FCC modular authorization** | Can support host integration under the grant's conditions. Check approved antenna, RF exposure, labeling, operating configuration and simultaneous transmitters. Host digital emissions and other applicable requirements remain to be assessed. |
| **UL/VDE isolation component evidence** | Supports specified insulation ratings and conditions for an isolator/component. It does not certify the breakout, custom carrier, complete product or lightning immunity. |
| **NMEA2000 certification** | Separate product and network/protocol certification. Using a CAN transceiver or library does not grant certification or permission to claim “NMEA 2000 Certified.” |

Primary references: [EU manufacturer responsibilities](https://single-market-economy.ec.europa.eu/single-market/goods/ce-marking/manufacturers_en), [EU Radio Equipment Directive](https://single-market-economy.ec.europa.eu/sectors/electrical-and-electronic-engineering-industries-eei/radio-equipment-directive-red_en), [RoHS](https://environment.ec.europa.eu/topics/waste-and-recycling/rohs-directive_en), [REACH](https://echa.europa.eu/regulations/reach/understanding-reach), [FCC KDB 996369 module/host integration guidance](https://apps.fcc.gov/oetcf/kdb/forms/FTSSearchResultPage.cfm?id=44637&switch=P), and [NMEA's certification process](https://www.nmea.org/nmea-2000.html).

## Evidence required before production claims

Collect signed declarations and applicable reports with exact model/revision coverage, traceable sourcing, radio grant and antenna conditions, and current material declarations. Identify applicable markets and legislation with the assessment provider; neither open-source distribution nor low sensor power establishes a blanket exemption.

Assess the complete operating configurations, including BLE plus Wi-Fi, GNSS reception, display and SD activity, charging, battery operation and attached marine cables. Cable transients, power conversion emissions, grounding and radio placement can change the result even when every board was previously tested separately. Validate temperature, ingress, condensation, corrosion and vibration independently of radio compliance.

Battery and shipping documentation, labeling, technical-file maintenance and production change control also need an owner. No fixed RF separation distance or completed-product compliance statement is prescribed here without evidence for the final configuration. Where Canada or another market is intended, obtain the applicable current local authorization and integration requirements as well.
