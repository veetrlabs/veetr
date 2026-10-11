---
title: Firmware
description: Software ESP32 v zařízení Veetr Vane od čtení snímačů a výpočtů až po BLE a aktualizace.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/FIRMWARE.md
---

Firmware Veetr spojuje měření snímačů do jednoho živého datového toku. Běží na ESP32 s frameworkem Arduino a sestavuje se pomocí PlatformIO.

## Co firmware dělá

- Čte polohu, rychlost vůči zemi, kurz, počet družic a kvalitu GPS.
- Čte rychlost a směr zdánlivého větru z ultrazvukového snímače.
- Pokud je dostupná IMU BNO080, čte směr, příčný a podélný náklon a zrychlení.
- Filtruje šum GPS při nízké rychlosti a počítá skutečný vítr ze zdánlivého větru a pohybu lodě.
- Při selhání jednotlivého snímače dál poskytuje zbývající hodnoty.
- Nabízí párování pouze během fyzicky aktivovaného okna vyhledávání.
- Odesílá telemetrii a přijímá příkazy přes BLE.
- Instaluje binární vydání odeslaná z PWA protokolem BLE aktualizací.

## Hardwarová rozhraní

| Vstup nebo ovládání | Rozhraní | Připojení ESP32 |
| --- | --- | --- |
| Ultrazvukový snímač větru | RS485 / Modbus | RX GPIO32, TX GPIO33, DE/RE GPIO14 |
| GPS přijímač | UART | RX GPIO16, TX GPIO17 |
| IMU BNO080 | I²C | SDA GPIO21, SCL GPIO22 |
| Tlačítko párování/vyhledávání | Digitální vstup | GPIO0 |
| Stavová LED | Digitální výstup | GPIO2 |

Montážní spoje uvádí **[Zapojení](/cs/docs/wiring/)** a prototypové hodnoty **[Technické údaje hardwaru](/cs/docs/hardware-reference/)**.

## BLE data a příkazy

Firmware je server BLE GATT. Připojená PWA odebírá charakteristiku snímačů a přijímá JSON oznámení v UTF-8, obvykle jednou za sekundu. Zkrácené názvy polí:

| Pole | Význam |
| --- | --- |
| `SOG`, `COG` | Rychlost a kurz vůči zemi |
| `AWS`, `AWA` | Rychlost a úhel zdánlivého větru |
| `TWS`, `TWA` | Vypočtená rychlost a úhel skutečného větru |
| `HDM`, `hl` | Magnetický směr a náklon |
| `lat`, `lon`, `sat`, `hdop` | GPS poloha a kvalita jejího určení |
| `ln` | Vzdálenost od nastavené startovní čáry se znaménkem |
| `rssi` | Síla BLE signálu hlášená ESP32 |

Příkazová charakteristika umožňuje vynulovat náklon, přejmenovat zařízení, nastavit či vymazat konce startovní čáry, vyžádat údaje o zařízení a firmwaru a řídit aktualizace.

## Párování a vyhledávání

Ovladač párování přepíná BLE vyhledávání. Při zapnutí svítí stavová LED a zařízení se nabízí nejvýše pět minut. Existující spojení mohou pokračovat i po ukončení nabízení. Veetr tak není dohledatelný celou plavbu.

Při nabízení se používá uložený název zařízení, aby šlo rozlišit více jednotek.

## Nastavení a odolnost

Název, obnovovací frekvence, kalibrace a souřadnice startovní čáry se ukládají do trvalých předvoleb ESP32. Dostupnost snímačů se řeší samostatně: chybějící vítr nebo pohyb se vynechá, ale GPS a BLE pokračují.

Telemetrie se udržuje pod dohodnutým limitem BLE. Pokud je zpráva velká, nejprve se odstraní diagnostické hodnoty s nižší prioritou, nikoli základní plavební data.

## Aktualizace firmwaru

Běžnou cestou je aktualizátor v PWA. Zkontroluje poslední vydání na GitHubu, stáhne binární soubor, přenese jej po potvrzovaných BLE blocích, vyžádá ověření ESP32 a aplikuje jej. Pro obnovu slouží USB s PlatformIO nebo ESPTool.

Postup uvádí **[Aktualizace firmwaru](/cs/docs/firmware-update/)**.

## Zdrojový kód a vývoj

- Hlavní program: [`firmware/src/main.cpp`](https://github.com/veetrlabs/veetr/blob/main/firmware/src/main.cpp)
- Sdílené moduly: [`firmware/include/`](https://github.com/veetrlabs/veetr/tree/main/firmware/include)
- Nativní testy: [`firmware/test/`](https://github.com/veetrlabs/veetr/tree/main/firmware/test)
- Nastavení sestavení: [`platformio.ini`](https://github.com/veetrlabs/veetr/blob/main/platformio.ini)

Sestavení a nahrání popisuje **[Nastavení PlatformIO](/cs/docs/platformio/)**, testovací sady **[Testování firmwaru](/cs/docs/firmware-testing/)**.
