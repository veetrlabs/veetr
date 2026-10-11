---
title: Technické údaje hardwaru
description: Rozhraní prototypu, frekvence dat, odhady spotřeby, chování firmwaru a omezení prostředí.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/HARDWARE_REFERENCE.md
---

Tato stránka shrnuje technické hodnoty současného prototypu. Jsou to implementační údaje a cíle testování, nikoli certifikované parametry výrobku.

## Řídicí jednotka

| Položka | Současný prototyp |
| --- | --- |
| Jednotka | ESP32-WROOM-32U na desce typu DevKitC |
| Framework | Arduino na Espressif32 |
| Paměť firmwaru | 4 MB flash uvedeného modulu |
| BLE | Vlastní služba plavebních dat |
| I²C | IMU na GPIO21/GPIO22 |
| GPS UART | RX GPIO16, TX GPIO17 |
| RS485 UART | RX GPIO32, TX GPIO33, DE/RE GPIO14 |

## Data firmwaru

- **GPS:** poloha, rychlost a kurz vůči zemi, počet družic a stav signálu.
- **Vítr:** rychlost a směr zdánlivého větru a odvozený skutečný vítr.
- **Pohyb:** směr, příčný a podélný náklon a další orientační údaje IMU.
- **Systém:** stav připojení, nastavení a dostupné chyby.

## Frekvence aktualizací prototypu

| Zdroj | Typické nastavení | Rozsah nebo omezení |
| --- | --- | --- |
| GPS | 1 Hz | Podle přijímače, běžně až 10 Hz |
| IMU | 10 Hz | Podle snímače, běžně až 100 Hz |
| Vítr | 1–5 Hz | Podle snímače a nastavení Modbus |
| Společný BLE tok | Cíl 10 Hz | Podle spojení a zapnutých hodnot |

## Napájení

| Stav | Odhad prototypu |
| --- | --- |
| Běžný provoz | Asi 200 mA při 5 V |
| Krátká špička | Až přibližně 400 mA |
| Zdroj | 5V USB-C powerbanka nebo vývojový počítač |
| Spánek | Budoucí práce, nikoli současný parametr výrobku |

Skutečná spotřeba závisí na desce, variantách snímačů, anténách, frekvencích a firmwaru. Před výběrem baterie na dlouhou plavbu změřte sestavenou jednotku.

## Chování nastavení

Firmware je navržen pro podporu:

- Korekce směru větru a magnetické deklinace
- Nastavitelných intervalů čtení snímačů
- Nastavení BLE zařízení a spojení
- Obnovení továrních hodnot
- Hlášení poruch snímačů a pokračování s dostupnými daty
- Obnovy zablokované jednotky pomocí watchdogu

Aktuální soubory nastavení a ukládání popisuje **[Ukládání dat](/cs/docs/storage/)**.

## Omezení prostředí

Dodavatelé mohou u jednotlivých modulů uvádět široké rozsahy teplot a vlhkosti. Tyto parametry necertifikují sestavený Veetr.

- Voděodolnost závisí na krabičce, těsnění, průchodkách, kvalitě sestavení a zkouškách.
- Dosah antén závisí na umístění, typu, materiálu krabičky a prostředí lodě.
- Vibrace, UV záření, slaná voda a kondenzace vyžadují ověření celé sestavy.
- Prototyp není certifikovaný navigační ani bezpečnostní přístroj.

Před popisováním nebo distribucí hotové jednotky čtěte **[Shoda a certifikace](/cs/docs/compliance/)**.

## Software a vývojové nástroje

- VS Code s PlatformIO
- Příkazy PlatformIO pro sestavení, nahrání a sériový monitor
- Webová aplikace Veetr pro integrační zkoušky BLE

Rozdělení práce mezi firmware a PWA uvádí **[Přehled softwaru](/cs/docs/software/)**. Pro práci na kódu pokračujte na **[Vývoj](/cs/docs/development/)** a **[Nastavení PlatformIO](/cs/docs/platformio/)**.
