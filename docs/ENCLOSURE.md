---
title: Enclosure and mounting
description: Print, assemble, mount, remove, and service the Veetr enclosure.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/ENCLOSURE.md
---

The Veetr enclosure protects the controller and keeps it in a repeatable position while remaining easy to remove for charging, updates, or service.

<a href="https://www.printables.com/model/1589439-veetr-box"><img src="/img/3d-veetr-box.png" alt="CAD render of the Veetr enclosure with its lid open" width="1832" height="1126" loading="lazy"></a>

## Get the model

**[Download the Veetr box from Printables](https://www.printables.com/model/1589439-veetr-box)** for the current printable model files and print information.

Check the model page for the latest revision before printing. Use the current files as one matching set: changes to the box, lid, hinge, mounting rail, or sliding features can affect how the parts fit together.

## How the removable mount works

The enclosure uses a separate mounting bar that acts as a rail:

1. Screw the rail to a wall, bulkhead, or other suitable flat surface.
2. Align the enclosure’s printed legs with the rail.
3. Slide the enclosure into the rail until it is fully seated.
4. To remove the unit, support it and slide it back out along the rail.

The rail returns the enclosure to the same position and orientation each time. This is especially useful because Veetr’s IMU measures heading and heel: after service or charging, the controller can go back into its established position instead of being mounted differently each time.

Choose screws and mounting preparation that suit the surface. Make sure the rail is secure, leave enough clearance to slide the enclosure out, and prevent water ingress around fastener holes where necessary. Re-check the sensor calibration if the rail position or enclosure fit changes.

## Allen key hinge pin

The lid hinge uses an **Allen key (hex key) as its hinge pin**. The long shaft passes through the aligned hinge sections and forms the hinge axis.

This gives the part two jobs:

- It lets the lid pivot normally while installed.
- It keeps the tool with the enclosure so it is available when the unit must be disassembled.

When opening the enclosure for service, pull the Allen key out of the hinge and use it for the enclosure fasteners. Removing the key also releases the hinge so the lid can be separated from the box. Reinsert it through every hinge section after reassembly, and check that the lid moves freely without forcing the printed parts.

Use the Allen key size intended by the current model. Do not force an oversized key through the hinge or replace it with a permanent pin if you want the disassembly tool to remain with the enclosure.

## Connector panel and lid controls

Looking at the recessed connector panel, the openings run from left to right:

| Position | Opening | Connection |
| --- | --- | --- |
| 1 | Rectangular | RJ45 socket for the ultrasonic wind sensor |
| 2 | Small round | External Bluetooth antenna |
| 3 | USB-C | Power, charging, and firmware programming |
| 4 | Large round | External GPS antenna |

The USB-C opening is a socket opening; no cable is permanently attached to it.

The two flexible controls printed into the lid press the ESP32’s onboard buttons:

- **Reset** presses the ESP32 reset/EN button.
- **Pairing** presses the BOOT button to start the pairing/discovery window.

Before closing the lid, confirm that both printed controls line up with the correct ESP32 buttons and return without sticking.

## Print and fit checks

- Follow the current file orientation and print guidance on Printables.
- Confirm that the box, lid, hinge, rail, and sliding legs are all from the same revision.
- Remove supports and clean sliding and hinge surfaces carefully; do not enlarge them aggressively.
- Test the rail fit before mounting it. The enclosure should slide securely without requiring excessive force.
- Dry-fit the PCB and every connector before final assembly.
- Check clearance around the antennas, RJ45 plug, and USB-C cable.
- Verify that the lid closes without pressing on the PCB, modules, or wiring.

## Service and removal

1. Disconnect power and external sensor or antenna cables.
2. Support the enclosure while sliding it out of the mounting rail.
3. Move it to a clean, dry work area.
4. Remove the Allen key from the hinge and use it to open the enclosure.
5. After service, reinstall the lid, return the key to the hinge, and slide the enclosure fully back into the rail.
6. Reconnect the cables and confirm sensor readings before use.

The printed enclosure and mount are prototype parts. Their water resistance, UV resistance, strength, and long-term fit depend on material, printer calibration, installation, and testing. Do not treat the enclosure as certified marine safety equipment.
