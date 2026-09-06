---
title: PCB and Gerber files
description: Download, inspect, manufacture, and modify the custom Veetr ESP32 carrier PCB.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/PCB.md
---

Veetr uses a custom two-layer carrier PCB to hold the ESP32 development board and the modular sensor interfaces. The repository includes ready-to-upload Gerber manufacturing files; the editable schematic and board layout are hosted on EasyEDA.

## Get the files

- **[Download the complete Gerber ZIP](https://github.com/veetrlabs/veetr/raw/refs/heads/main/pcb/veetr-esp32-breakout-gerbers-v2.0.zip)** — use this archive when ordering a bare PCB.
- **[Open the editable EasyEDA project](https://oshwlab.com/linhartescope/esp32-breakout-board)** — inspect or fork the schematic, PCB layout, component placement, bill of materials, and 3D preview.
- **[Browse the PCB directory on GitHub](https://github.com/veetrlabs/veetr/tree/main/pcb)** — view the README, assembly photo, archive, and individual fabrication files.
- **[Browse the individual Gerber files](https://github.com/veetrlabs/veetr/tree/main/pcb/gerbers)** — useful for inspection and version comparison.

The current archive is named `veetr-esp32-breakout-gerbers-v2.0.zip`. Check the repository for a newer revision before ordering boards.

## What the Gerber archive contains

| Files | Purpose |
| --- | --- |
| `Gerber_TopLayer.GTL`, `Gerber_BottomLayer.GBL` | Top and bottom copper |
| `Gerber_TopSolderMaskLayer.GTS`, `Gerber_BottomSolderMaskLayer.GBS` | Solder-mask openings |
| `Gerber_TopSilkscreenLayer.GTO`, `Gerber_BottomSilkscreenLayer.GBO` | Printed component labels and markings |
| `Gerber_BoardOutlineLayer.GKO` | Board shape used by the fabricator |
| `Gerber_DocumentLayer.GDL` | Additional drawing information |
| `Drill_PTH_Through.DRL`, `Drill_PTH_Through_Via.DRL` | Plated holes and vias |
| `Drill_NPTH_Through.DRL` | Non-plated holes |

These files describe the **bare PCB**. The archive does not include the ESP32, sensor modules, connectors, enclosure, or assembly service files.

## Order a prototype board

1. Download the Gerber ZIP without unpacking or renaming its contents.
2. Upload the ZIP to your PCB manufacturer’s Gerber viewer.
3. Confirm that the viewer shows two copper layers, the complete board outline, solder masks, silkscreens, and all drill files.
4. Select a standard **two-layer FR-4 board**, **1.6 mm thickness**, with either **HASL or ENIG** surface finish.
5. Run the manufacturer’s design-rule or manufacturability checks before paying.
6. Order a small prototype quantity first and verify the physical fit before ordering a larger batch.

The repository README lists 0.1 mm minimum trace width and 0.2 mm minimum via size. Confirm that your chosen manufacturer supports those values and do not infer missing dimensions from screenshots.

## Modify the design

Use the EasyEDA project when you need to change the schematic, footprints, connector positions, or board outline. Fork the project before editing, then regenerate every Gerber and drill layer as one matching revision. Do not mix files from different exports.

If your changes affect connector placement or the board outline, update and test the enclosure before manufacturing. The current enclosure exposes RJ45, BLE antenna, USB-C, and GPS antenna openings in fixed positions.

## Before assembly

- Compare the PCB revision with the **[components list](https://veetr.org/docs/components/)** and **[wiring guide](https://veetr.org/docs/wiring/)**.
- Check connector orientation, module pin order, supply voltage, and 3.3 V logic compatibility.
- Inspect the fabricated board for shorts and verify power rails before inserting the ESP32 or sensor modules.
- Treat this as open prototype hardware, not a certified navigation or safety instrument. See **[compliance and certifications](https://veetr.org/docs/compliance/)**.

