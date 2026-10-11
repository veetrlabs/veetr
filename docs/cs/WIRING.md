---
title: Zapojení
description: Přehledné zapojení snímačů, ESP32, antén, ovladačů a napájení Veetr.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/WIRING.md
---

Tento návod slouží k sestavení a diagnostice současného prototypu. Ukazuje pouze používané spoje, není třeba studovat celé zapojení pinů ESP32.

> **Před připojováním:** odpojte USB napájení, ověřte označení přesných revizí modulů a multimetrem zkontrolujte napětí. Nikdy nepřipojujte vodiče RS485 `A` nebo `B` snímače větru přímo na ESP32.

## Konektory krabičky

Při pohledu na zapuštěný panel připojujte porty zleva doprava:

| Pozice | Port | Připojení | Poznámky |
| --- | --- | --- | --- |
| 1 | RJ45 | Ultrazvukový snímač větru | Přivádí kabel snímače větru do krabičky |
| 2 | Konektor BLE antény | Externí anténa 2,4 GHz | Připojte před zavřením krabičky |
| 3 | USB-C | Powerbanka nebo vývojový počítač | Napájí jednotku a programuje ESP32 |
| 4 | Konektor GPS antény | Externí GPS anténa | Používá tenký koaxiální kabel GPS |

## Přehled pinů Veetr

Prototyp používá následující signály ESP32:

| Pin ESP32 | Připojené zařízení | Signál | Směr |
| --- | --- | --- | --- |
| 3V3 | IMU a kompatibilní logické moduly | Napájení 3,3 V | Napájecí výstup |
| GND | Všechny moduly | Společná zem | — |
| GPIO21 | BNO080/BNO085 | I²C SDA | Obousměrný |
| GPIO22 | BNO080/BNO085 | I²C SCL | Výstup |
| GPIO16 | TX GPS modulu | UART RX | Vstup |
| GPIO17 | RX GPS modulu | UART TX | Výstup |
| GPIO32 | RO převodníku RS485 | UART RX | Vstup |
| GPIO33 | DI převodníku RS485 | UART TX | Výstup |
| GPIO14 | DE/RE převodníku RS485 | Povolení vysílání/příjmu | Výstup |
| GPIO0 / BOOT | Ovladač párování na víku | Tlačítko párování/vyhledávání | Vstup |
| EN / RESET | Ovladač resetu na víku | Reset jednotky | Vstup |
| GPIO2 | Stavová LED | Signálizace stavu | Výstup |
| GPIO25 | Volitelné ovládání LED na stěžni | Ovládání kotevního světla | Výstup |

## Zapojení IMU

| BNO080/BNO085 | ESP32 |
| --- | --- |
| `VCC` | `3V3` |
| `GND` | `GND` |
| `SDA` | `GPIO21` |
| `SCL` | `GPIO22` |

## Zapojení GPS

Vodiče UART se kříží: vysílač GPS vede do přijímače ESP32.

| GPS modul | ESP32 |
| --- | --- |
| `VCC` | Napětí podporované vaším modulem |
| `GND` | `GND` |
| `TX` | `GPIO16` / ESP32 RX |
| `RX` | `GPIO17` / ESP32 TX |

## Snímač větru a převodník RS485

Převodník je mezi snímačem větru a ESP32.

### Strana snímače

| Snímač větru | Převodník RS485 |
| --- | --- |
| `A` nebo `A+` | `A` nebo `A+` |
| `B` nebo `B-` | `B` nebo `B-` |
| Kladné napájení | Napětí požadované snímačem |
| `GND` | Společná `GND` |

Pokud nepřicházejí data, ověřte označení `A`/`B` u výrobce. Někteří dodavatelé označují diferenciální pár opačně.

### Strana ESP32

| Převodník RS485 | ESP32 |
| --- | --- |
| Logické `VCC` | Napětí podporované převodníkem a logikou ESP32 |
| `GND` | `GND` |
| `RO` / výstup přijímače | `GPIO32` |
| `DI` / vstup vysílače | `GPIO33` |
| `DE` a `RE` | `GPIO14` |

## Ovladače víka

Krabička nepřidává samostatné elektrické spínače. Její dva pružné výstupky mačkají tlačítka osazená na desce ESP32:

| Ovladač víka | Tlačítko ESP32 | Výsledek |
| --- | --- | --- |
| Reset | `EN` / `RESET` | Restartuje jednotku |
| Párování | `BOOT` / `GPIO0` | Spouští párování/vyhledávání firmwaru |

ESP32 pečlivě zarovnejte, aby každý výstupek mačkal správné tlačítko a zavřené víko jej nedrželo stisknuté.

## Kontrola před prvním zapnutím

1. Zkontrolujte můstky pájky, obrácené moduly a volná vlákna vodičů.
2. Ověřte společnou zem všech modulů.
3. Zkontrolujte napájecí napětí každého modulu.
4. Při první zkoušce USB napájení nechte externí snímač větru odpojený.
5. Připojte USB-C a ověřte běžné chování indikátoru napájení ESP32.
6. Přidávejte IMU a GPS postupně a po každém kroku zkontrolujte sériový výpis.
7. Připojte převodník RS485 a nakonec snímač větru.

Příkazy pro sestavení, nahrání a sériový monitor uvádí **[Nastavení PlatformIO](/cs/docs/platformio/)**.
