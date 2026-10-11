---
title: Přehled hardwaru
description: Jak spolupracují řídicí jednotka Veetr, snímače, antény a jachtařský přístrojový panel.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/HARDWARE.md
---

Veetr Vane je jachtařský přístroj rodiny Veetr založený na ESP32. Přenosná řídicí jednotka čte snímače větru, pohybu a GPS, vypočítává plavební údaje a odesílá je do webové aplikace přes Bluetooth Low Energy (BLE).

![Deska Veetr v prototypové krabičce](../../pcb/Veetr-in-box.jpg)

## Proč Veetr Vane?

„Vane“ propojuje angličtinu a češtinu: anglicky označuje větrnou korouhev, česky **„vítr vane“**. Přístroj tak získává vlastní jméno a zachovává české kořeny.

## Stručný přehled

| Součást | Funkce | Připojení |
| --- | --- | --- |
| Řídicí jednotka ESP32 | Čte snímače, počítá hodnoty a poskytuje BLE data | Centrální jednotka |
| IMU BNO080/BNO085 | Měří orientaci, směr a náklon | I²C |
| GPS modul | Poskytuje polohu a rychlost vůči zemi | UART |
| Ultrazvukový snímač větru | Měří rychlost a směr zdánlivého větru | RS485 přes převodník |
| Webová aplikace Veetr | Zobrazuje živé přístroje | BLE |

## Tok dat

1. Snímače větru, GPS a pohybu posílají měření do ESP32.
2. ESP32 je kombinuje na údaje jako skutečný vítr, směr, náklon a rychlost vůči zemi.
3. BLE odesílá aktuální hodnoty do webové aplikace Veetr.
4. Aplikace může zpět odesílat změny nastavení.

## Konektory

Při pohledu na zapuštěný panel jsou konektory zleva doprava:

| Pozice | Konektor | Účel |
| --- | --- | --- |
| 1 | RJ45 | Ultrazvukový snímač větru |
| 2 | Anténní konektor typu SMA | Externí BLE anténa |
| 3 | USB-C | Napájení a programování firmwaru |
| 4 | Anténní konektor typu SMA | Externí GPS anténa |

Dva pružné ovladače ve víku mačkají tlačítka na ESP32. Jeden jednotku resetuje, druhý přes BOOT spouští párování a vyhledávání.

## Priority návrhu

- **Modularita:** moduly snímačů používají běžné pinové lišty a lze je měnit samostatně.
- **Opravitelnost:** porucha modulu neznamená výměnu celého přístroje.
- **Přenosnost:** prototyp může běžet z USB-C powerbanky místo lodní sítě.
- **Otevřenost:** soubory PCB, firmware, aplikace a dokumentace jsou otevřené.
- **Přizpůsobitelnost:** moduly lze před osazením na nosnou desku vyzkoušet na nepájivém poli.

## Další návody

- **[Součástky](/cs/docs/components/):** výběr jednotky, snímačů, antén, převodníku, desky a krabičky.
- **[PCB a Gerber soubory](/cs/docs/pcb/):** stažení, úpravy a objednání prototypové desky.
- **[Krabička a upevnění](/cs/docs/enclosure/):** tisk, odnímatelná lišta a pant s imbusovým klíčem.
- **[Zapojení](/cs/docs/wiring/):** připojení modulů a ověření signálů před zapnutím.
- **[Technické údaje hardwaru](/cs/docs/hardware-reference/):** rozhraní, frekvence, spotřeba a omezení prostředí.
- **[Ukládání dat](/cs/docs/storage/):** nastavení a souborový systém.
- **[Shoda a certifikace](/cs/docs/compliance/):** co je a není certifikováno.
