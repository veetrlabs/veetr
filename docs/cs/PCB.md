---
title: PCB a Gerber soubory
description: Stažení, kontrola, výroba a úpravy nosné desky Veetr pro ESP32.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/PCB.md
---

Veetr používá vlastní dvouvrstvou nosnou desku pro ESP32 a modulární rozhraní snímačů. Repozitář obsahuje výrobní Gerber soubory; upravitelné schéma a návrh jsou na EasyEDA.

## Soubory ke stažení

- **[Kompletní ZIP s Gerber soubory](https://github.com/veetrlabs/veetr/raw/refs/heads/main/pcb/veetr-esp32-breakout-gerbers-v2.0.zip)** – pro objednání neosazené desky.
- **[Upravitelný projekt EasyEDA](https://oshwlab.com/linhartescope/esp32-breakout-board)** – schéma, návrh, rozmístění součástek, kusovník a 3D náhled; lze vytvořit vlastní kopii.
- **[Adresář PCB na GitHubu](https://github.com/veetrlabs/veetr/tree/main/pcb)** – README, fotografie sestavy, archiv a jednotlivé výrobní soubory.
- **[Jednotlivé Gerber soubory](https://github.com/veetrlabs/veetr/tree/main/pcb/gerbers)** – pro kontrolu a porovnání verzí.

Aktuální archiv je `veetr-esp32-breakout-gerbers-v2.0.zip`. Před objednávkou ověřte, zda neexistuje novější revize.

## Obsah archivu

| Soubory | Účel |
| --- | --- |
| `Gerber_TopLayer.GTL`, `Gerber_BottomLayer.GBL` | Horní a spodní měď |
| `Gerber_TopSolderMaskLayer.GTS`, `Gerber_BottomSolderMaskLayer.GBS` | Otvory nepájivé masky |
| `Gerber_TopSilkscreenLayer.GTO`, `Gerber_BottomSilkscreenLayer.GBO` | Potisk a označení součástek |
| `Gerber_BoardOutlineLayer.GKO` | Obrys desky pro výrobce |
| `Gerber_DocumentLayer.GDL` | Doplňující výkres |
| `Drill_PTH_Through.DRL`, `Drill_PTH_Through_Via.DRL` | Prokovené otvory a prokovy |
| `Drill_NPTH_Through.DRL` | Neprokovené otvory |

Soubory popisují **neosazenou desku**. Archiv neobsahuje ESP32, snímače, konektory, krabičku ani soubory pro službu osazení.

## Objednání prototypu

1. Stáhněte ZIP bez rozbalování a přejmenování obsahu.
2. Nahrajte jej do prohlížeče Gerber souborů výrobce.
3. Ověřte dvě měděné vrstvy, celý obrys, masky, potisky a všechny vrtací soubory.
4. Zvolte standardní **dvouvrstvou FR-4 desku**, **tloušťku 1,6 mm** a povrch **HASL nebo ENIG**.
5. Před zaplacením spusťte kontrolu výrobních pravidel výrobce.
6. Nejprve objednejte malé prototypové množství a ověřte rozměrovou shodu.

README uvádí minimální šířku spoje 0,1 mm a minimální velikost prokovu 0,2 mm. Ověřte podporu výrobce; chybějící rozměry neodvozujte z obrázků.

## Úpravy návrhu

Schéma, pouzdra, konektory i obrys měňte v EasyEDA. Nejprve vytvořte vlastní kopii a poté vyexportujte všechny Gerber i vrtací vrstvy jako jednu revizi. Nemíchejte soubory z různých exportů.

Při změně konektorů nebo obrysu upravte a vyzkoušejte krabičku před výrobou. Současná krabička má pevné pozice otvorů RJ45, BLE antény, USB-C a GPS antény.

## Před sestavením

- Porovnejte revizi desky se **[seznamem součástek](/cs/docs/components/)** a **[zapojením](/cs/docs/wiring/)**.
- Ověřte orientaci konektorů, pořadí pinů, napájení a kompatibilitu logiky 3,3 V.
- Před osazením ESP32 a snímačů zkontrolujte zkraty a napájecí větve.
- Jde o otevřený prototyp, ne certifikovaný navigační nebo bezpečnostní přístroj. Viz **[Shoda a certifikace](/cs/docs/compliance/)**.
