---
title: Progresivní webová aplikace
description: Jak instalovatelný přístrojový panel Veetr připojuje, zobrazuje, ukládá a spravuje plavební data.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/PWA.md
---

Progresivní webová aplikace Veetr (PWA) zobrazuje a ovládá hardware. Používá React a TypeScript, běží na **[app.veetr.org](https://app.veetr.org/)** a lze ji instalovat z kompatibilního prohlížeče bez obchodu s aplikacemi.

## Funkce PWA

- Přímé připojení k zařízení Veetr Vane přes Web Bluetooth API.
- Zobrazení zdánlivého a skutečného větru, rychlosti, směru, náklonu, kvality GPS, síly signálu a vzdálenosti od startovní čáry.
- Vyhlazení pohybu přístrojů bez změny surových hodnot firmwaru.
- Místní ukládání desetisekundových průměrů pro grafy a historii.
- Poloha a zaznamenaná stopa na OpenStreetMap a OpenSeaMap.
- Příkazy kalibrace, názvu zařízení a startovní čáry.
- Kontrola vydání na GitHubu a aktualizace firmwaru přes BLE.
- Světlé a tmavé zobrazení a rozvržení přizpůsobené displejům v kokpitu.

## Požadavky na prohlížeč

Veetr potřebuje Web Bluetooth API. Obvyklou volbou jsou Chrome, Edge a další prohlížeče založené na Chromiu na Androidu, Windows, macOS, ChromeOS a Linuxu, pokud to podporuje prohlížeč a Bluetooth adaptér.

Safari a Firefox potřebné připojení neposkytují. Na iPhonu a iPadu použijte Bluefy podle **[uživatelského nastavení](/cs/docs/)**; instalace a chování offline se mohou od Chromia lišit.

Prohlížeč povolí Bluetooth pouze aplikaci přes HTTPS nebo při vývoji na `localhost`.

## Připojení

Po zvolení Připojit otevře prohlížeč vlastní výběr Bluetooth zařízení. PWA filtruje službu Veetr, připojí se ke GATT serveru, přihlásí odběr telemetrie a najde zapisovatelnou příkazovou charakteristiku.

Po připojení si vyžádá verzi firmwaru a uloženou startovní čáru. Příchozí JSON pole převádí do společného datového modelu a sleduje čas poslední zprávy, aby bylo vidět zastaralé či přerušené spojení.

Bluetooth oprávnění patří prohlížeči a zařízení. Veetr nemůže skrytě vyhledávat okolní hardware ani obejít výzvu k párování.

## Místní data a provoz offline

Service worker ukládá rozhraní a načtené soubory do mezipaměti. Poté lze panel znovu otevřít bez internetu a pokračovat v komunikaci přes Bluetooth.

Historie snímačů se ukládá jen v IndexedDB aktuálního prohlížeče. Vzorky se průměrují po deseti sekundách a automaticky promazávají, aby úložiště nerostlo neomezeně. Vymazání dat webu odstraní i historii.

Offline provoz má omezení:

- První načtení nové instalace potřebuje internet.
- Dosud nenačtené mapové dlaždice vyžadují připojení.
- Kontrola a stažení firmwaru vyžadují GitHub.
- Dostupnost Web Bluetooth závisí na systému a prohlížeči.

## Přístroje a ovládání

Hlavní pohled spojuje velký ukazatel směru větru s kartami zdánlivého a skutečného větru, rychlosti, směru, vzdálenosti ke startovní čáře a náklonu. Mapa kreslí stopu z uložených GPS měření.

Nastavení obsahuje stav Bluetooth, kalibraci náklonu, název zařízení, startovní čáru, verzi a aktualizace firmwaru, vzhled a diagnostiku dlouho běžících instalovaných relací.

## Zdrojový kód a vývoj

- Vstup aplikace: [`app/src/main.tsx`](https://github.com/veetrlabs/veetr/blob/main/app/src/main.tsx)
- BLE připojení a stav: [`app/src/context/BLEContext.tsx`](https://github.com/veetrlabs/veetr/blob/main/app/src/context/BLEContext.tsx)
- Přístroje a ovládání: [`app/src/components/`](https://github.com/veetrlabs/veetr/tree/main/app/src/components)
- Místní historie: [`app/src/utils/dataStorage.ts`](https://github.com/veetrlabs/veetr/blob/main/app/src/utils/dataStorage.ts)
- Sdílené datové typy: [`packages/shared/`](https://github.com/veetrlabs/veetr/tree/main/packages/shared)

Místní spuštění popisuje **[Vývoj](/cs/docs/development/)**. Druhou část systému popisuje **[Firmware](/cs/docs/firmware/)**.
