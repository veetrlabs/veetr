---
title: Uživatelské nastavení
description: Připojení telefonu, tabletu nebo notebooku k zařízení Veetr Vane a kalibrace přístrojů.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/SETUP.md
---

Postup pro jachtaře, jak zprovoznit přístrojový panel Veetr.

Hledáte aplikaci pro Android nebo iPhone? Přístup k betě a instalaci popisuje [Mobilní aplikace](/cs/docs/mobile-apps/). Následující návod se týká webového přístrojového panelu.

Potřebujete pomoc s regatou? Začněte [návodem ke správě závodů](/cs/docs/race-guide/) a vyberte svou roli.

## Co potřebujete 🛒

### Hardware

Podrobné specifikace a odkazy na součástky najdete v **[návodu k hardwaru](/cs/docs/hardware/)**.

### Podporovaná zařízení

- **iPhone/iPad:** použijte [Bluefy – Web BLE Browser](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055); Safari nepodporuje potřebné Bluetooth připojení.
- **Android:** zařízení s prohlížečem Chrome, Edge nebo Opera.
- **Počítač:** Windows, Mac nebo Linux s Chrome, Edge nebo Opera.

## Postup nastavení 🔧

### 1. Otevřete aplikaci Veetr

**Webová aplikace:** https://app.veetr.org

**Instalace jako aplikace (doporučeno):**

**📱 iPhone/iPad:**

- Safari v iOS nepodporuje Web Bluetooth.
- Z App Storu stáhněte [Bluefy – Web BLE Browser](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055).
- V Bluefy otevřete https://app.veetr.org.
- Nativní aplikaci pro iPhone popisuje [Mobilní aplikace](/cs/docs/mobile-apps/).

**📱 Telefon nebo tablet s Androidem:**

- Otevřete Chrome a https://app.veetr.org.
- Klepněte na nabídku (⋮) → **Přidat na plochu** → **Přidat**.
- Případně použijte nabídku **Nainstalovat aplikaci** ve spodní části obrazovky.

**💻 Windows:**

- V Chrome nebo Edge otevřete https://app.veetr.org.
- Klikněte na instalační ikonu (⊞) v adresním řádku → **Nainstalovat**.
- Případně použijte nabídku (⋮) → **Nainstalovat Veetr…**.

**💻 Mac:**

- Otevřete https://app.veetr.org v Chrome, Edge nebo Safari.
- V Chrome/Edge použijte instalační ikonu (⊞) → **Nainstalovat**.
- Safari nabízí **Sdílet → Přidat do Docku**, ale připojení Bluetooth vyžaduje kompatibilní prohlížeč.

**💻 Linux:**

- Otevřete https://app.veetr.org v Chrome nebo Chromiu.
- Použijte instalační ikonu (⊞) → **Nainstalovat**.
- Firefox lze použít k prohlížení stránky, ale nepodporuje potřebné Web Bluetooth připojení.

### 2. Připravte Veetr Vane

1. Umístěte GPS modul s vestavěnou anténou; pro lepší příjem lze připojit externí anténu.
2. Připojte anténu BLE (Bluetooth Low Energy).
3. Připojte snímač větru konektorem RJ45.

### 3. Připojení k lodi 🔗

**První připojení:**

1. **Zapněte Veetr Vane** připojením powerbanky přes USB-C.
2. Zařízení je po spuštění **5 minut v režimu vyhledávání**.
3. V tomto režimu svítí vestavěná modrá LED. Po 5 minutách z bezpečnostních důvodů zhasne.
4. Otevřete aplikaci Veetr.
5. Klepněte na **Připojit**.
6. V seznamu Bluetooth vyberte **Veetr**.
7. Sledujte živá data při plavbě. ⛵

**Každodenní použití:**

- Režim vyhledávání se po 5 minutách automaticky vypne.
- Tlačítkem BOOT jej kdykoli znovu zapněte.
- Zařízení je nutné znovu připojit i v aplikaci.

### Kalibrace

Po připojení a zobrazení dat Veetr zkalibrujte pro správné měření.

#### Orientace snímače 📐

Veetr Vane lze upevnit **v libovolné orientaci**: vodorovně, svisle, vzhůru nohama nebo pod úhlem. Kalibrace se orientaci snímače přizpůsobí.

Upevněte jej pevně, aby se nepohyboval, a vyhněte se místům se silnými vibracemi. Kalibrace předpokládá stálou polohu.

#### Kalibrace roviny ⚖️

Kalibrujte, když je loď zcela rovně, bez náklonu.

1. Najděte klidnou vodu nebo zajistěte loď v rovině u mola či vyvázání.
2. V přístrojovém panelu otevřete **Nastavení**.
3. Stiskněte **Vynulovat náklon** (Reset Level).
4. Zařízení nyní zná rovinu pro vaši montážní orientaci.

Uloží se prostorová orientace snímače v rovině, aby se správně počítal příčný i podélný náklon nezávisle na montáži. Rovinu lze znovu kalibrovat bez změny kalibrace kompasu.

#### Kalibrace severu 🧭

Provádějte ji po kalibraci roviny nebo při potřebě změnit severní referenci.

1. Natočte příď lodě k magnetickému severu. Použijte lodní či telefonní kompas nebo známé orientační body. Loď může být nakloněná.
2. Otevřete **Nastavení**.
3. Stiskněte **Nastavit sever kompasu** (Set Compass North).
4. Zařízení nyní zná podélnou osu lodě a magnetický sever.

Uloží se prostorová orientace snímače při přídi mířící na sever. Kalibraci severu lze opakovat bez ovlivnění roviny.

#### Kalibrace směru větru 💨

Po montáži zkontrolujte, že šipka na snímači směřuje k přídi. Směr větru se pak vztahuje ke směru lodě.

#### GPS 🛰️

GPS ruční kalibraci nepotřebuje.

- Modul má vestavěnou keramickou anténu a může pracovat bez externí antény.
- Pro obtížné podmínky lze přes U.FL připojit externí aktivní anténu.
- Anténní stranu modulu orientujte vzhůru s volným výhledem na oblohu.
- Vyhněte se kovovým plochám, stěžňům a střechám kajuty, které stíní družice.
- Na první určení polohy po umístění počkejte 1–2 minuty.
- GPS automaticky poskytuje polohu a rychlost.

**Údaje GPS v aplikaci:**

- **SAT:** počet připojených družic; pro dobré určení polohy jsou potřeba alespoň 4.
- **HDOP:** horizontální geometrie družic; nižší hodnota je lepší. Hodnoty 1–2 značí dobrou geometrii, 2–5 horší a nad 5 slabou. Samotné HDOP nezaručuje konkrétní přesnost v metrech. Zlepšete výhled na oblohu nebo použijte externí anténu.
- **LAT/LON:** aktuální zeměpisná šířka a délka.

## Řešení problémů 🔧

### Panel se nepřipojuje

- Na iPhonu/iPadu použijte [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055), ne Safari.
- Na Androidu a počítači použijte Chrome, Edge nebo Opera, ne Safari či Firefox.
- Tlačítkem BOOT na ESP32 zapněte vyhledávání a ověřte svítící LED.
- Obnovte stránku přístrojového panelu.

### Chybějí data ze snímačů

- Zkontrolujte všechny vodiče snímačů.
- Ověřte 5V napájení snímače větru. Při napájení svítí červená LED.
- Ověřte montáž; snímač větru potřebuje volný prostor v celém úhlu 360°.

### Nesprávný směr větru

- Ověřte, že šipka na snímači míří k přídi.

### GPS nefunguje

- GPS je volitelná a nemusí být připojená.
- Zajistěte výhled na oblohu.
- Na získání družic počkejte 1–2 minuty.
