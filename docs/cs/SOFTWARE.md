---
title: Přehled softwaru
description: Jak spolupracují firmware Veetr, nativní aplikace, webový přístrojový panel a správa závodů.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/SOFTWARE.md
---

Veetr propojuje **firmware ve Veetr Vane**, **nativní aplikace pro iPhone a Android**, **progresivní webovou aplikaci (PWA)** a **správu závodů na webu**. Mobilní aplikací zaznamenávejte plavbu pomocí GPS telefonu, připojte Veetr Vane pro přístrojová data nebo se přidejte k závodu připravenému na webu.

## Části softwaru

| Software | Kde běží | Hlavní úkol |
| --- | --- | --- |
| **[Firmware](/cs/docs/firmware/)** | ESP32 uvnitř zařízení Veetr Vane | Čte vítr, GPS a pohyb, počítá odvozené hodnoty, ukládá nastavení a poskytuje data přes BLE. |
| **[Progresivní webová aplikace](/cs/docs/pwa/)** | Kompatibilní prohlížeč | Připojuje se k zařízení Veetr Vane, zobrazuje přístroje, místní historii a mapu a spravuje zařízení. |
| **[Nativní aplikace](/cs/docs/native-apps/)** | iPhone a Android | Zobrazují přístroje, zaznamenávají plavby, ukazují závodní tratě a nabízejí startovní čáru a hlídání kotvy. GPS záznam funguje i bez Veetr Vane. |
| **[Správa závodů](/cs/docs/race-guide/)** | Web Veetr | Spravuje seriály, pozvánky, tratě, rozjížďky, sledování a výsledky pro rozhodčí, jachtaře a diváky. |

## Od snímače k obrazovce

1. Firmware čte ultrazvukový snímač větru přes RS485, GPS přes UART a IMU přes I²C.
2. Ověřuje měření a počítá například rychlost a úhel skutečného větru.
3. Přibližně jednou za sekundu odešle kompaktní JSON zprávu jako BLE oznámení.
4. Nativní aplikace nebo PWA převádí zprávu na přístroje rychlosti, větru, směru, náklonu, GPS a startovní čáry.
5. Opačným směrem putují příkazy ke kalibraci, přejmenování, nastavení startovní čáry a aktualizaci.

```text
Vítr + GPS + IMU → firmware ESP32 → Bluetooth LE → nativní aplikace nebo PWA → přístroje a místní historie
                                              ← příkazy a aktualizace firmwaru
```

## Přímé připojení přístroje

Živá přístrojová data tečou přes Bluetooth přímo mezi zobrazovacím zařízením a Veetr Vane, bez cloudové služby. PWA ukládá historii v IndexedDB prohlížeče a ESP32 ukládá nastavení do trvalé paměti. Ani jedno se nenahrává do účtu Veetr.

Internet je užitečný pro načtení a aktualizaci PWA, kontrolu nového firmwaru na GitHubu a stahování map. Rozhraní uložené v mezipaměti a existující BLE spojení mohou pokračovat bez internetu.

Nativní aplikace také ukládají záznamy do telefonu. Pozvánky, živé sdílení polohy a účty používají online služby. Podrobnosti najdete v [nativních aplikacích](/cs/docs/native-apps/) a [návodu k záznamu a sdílení](/cs/docs/share-your-trip/).

## Vyberte, co potřebujete

- **Mobilní aplikace:** [popis funkcí](/cs/docs/native-apps/) nebo [ukázky a přístup k betě](/cs/docs/mobile-apps/).
- **Používání zařízení Veetr Vane:** začněte **[uživatelským nastavením](/cs/docs/)**, později využijte **[aktualizaci firmwaru](/cs/docs/firmware-update/)**.
- **Porozumění zařízení:** **[Firmware](/cs/docs/firmware/)** a **[PWA](/cs/docs/pwa/)**.
- **Přispívání kódem:** **[Vývoj](/cs/docs/development/)** a **[Nastavení PlatformIO](/cs/docs/platformio/)**.
