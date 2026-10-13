---
title: Compliance and certifications
description: Recorded compliance status and component evidence for Veetr Vane.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/COMPLIANCE.md
---

Veetr Vane is an open hardware project. **No completed-product certification or EU Declaration of Conformity for an assembled Veetr Vane is documented in this repository.** Component approvals listed below apply to the identified components, not automatically to the assembled product.

Status reviewed: **2026-10-13**. This page records the evidence available to the project; it is not a product declaration.

## Veetr Vane product status

| Area | Recorded project status |
| --- | --- |
| EU CE / Radio Equipment Directive | No Veetr Vane declaration or completed-product assessment recorded. |
| US FCC | No completed-host compliance assessment recorded. Radio-module evidence is separate, as listed below. |
| Canada ISED | No completed-product assessment recorded. |
| RoHS / REACH | No declaration covering the complete Veetr Vane BOM and assembly recorded. Some proposed modules have supplier RoHS evidence. |
| NMEA2000 | The RLCD v2 interface is a proposal; RX/TX integration and interoperability testing remain pending. No Veetr NMEA2000 certification recorded. |
| Environmental and electrical qualification | No completed-assembly ingress, salt/condensation, vibration, transient or battery-system qualification reports recorded. |

These statuses cover the original ESP32 prototype and the proposed RLCD v2 assembly. They describe the project's evidence, rather than a finding that any particular unit has passed or failed an assessment.

## Component evidence

| Hardware / component | Evidence recorded | Scope |
| --- | --- | --- |
| Original ESP32 prototype: ESP32-WROOM-32U | The original prototype specifies this radio module. Matching grants and integration conditions are not archived with a validated Veetr assembly. | Component identification; no completed-product approval established here. |
| RLCD v2 proposal: ESP32-S3-WROOM-1-N16R8 | Identified in the [Waveshare schematic](https://files.waveshare.com/wiki/ESP32-S3-RLCD-4.2/ESP32-S3-RLCD-4.2-schematic.pdf). [Espressif's catalogue](https://www.espressif.com/en/support/documents/certificates) lists WROOM-1 CE and FCC documents. | Espressif radio module. A whole-RLCD-board declaration is not recorded. |
| Proposed CAN interface: Olimex A20-CAN-ISO | [Signed EU declaration](https://www.olimex.com/Products/OLinuXino/A20/A20-CAN/resources/EU-DOC-A20-CAN.pdf), dated 2021-07-08, covers A20-CAN and A20-CAN-ISO under EMC and RoHS. | Olimex board; not the Veetr carrier or complete assembly. |
| Proposed GNSS: MAX-M10S on SparkFun GPS-18037 (preferred) or MIKROE-4643 (alternative) | [u-blox MAX-M10 declaration](https://content.u-blox.com/sites/default/files/documents/MAX-M10_RED_Conformity_UBX-22013367.pdf), R06 dated 2025-11-26, covers RED/RoHS with a specified external antenna. | u-blox module and stated configuration; not either third-party breakout automatically. |

The v2 components above remain candidates, not a released production BOM. Evidence for alternatives and gaps in exact-board CE, FCC and REACH documentation are recorded in the [RLCD v2 hardware plan](RLCD_V2_HARDWARE.md#regulatory-evidence-and-supply-confidence).

## Qualification work

The [hardware plan's acceptance gates](RLCD_V2_HARDWARE.md#open-verification-items-and-acceptance-gates) track the outstanding electrical, functional, environmental and procurement checks. That plan also explains the different regulatory documents and their limits. This page will be updated when project-specific declarations or assessment reports become available.
