---
title: Ukládání dat
description: Úložiště prohlížeče a ESP32, omezení, soukromí a nastavení.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/STORAGE.md
---

Dokumentace ukládání, zachování nastavení a protokolování v systému Veetr. Tato stránka se týká firmwaru a webového přístrojového panelu; mobilní záznamy a online sdílení popisují [Nativní aplikace](/cs/docs/native-apps/).

## Architektura úložišť

### 🌐 Webový přístrojový panel

Prohlížeč ukládá předvolby a data relace.

#### Local Storage

- Nastavení připojení a dříve spárovaná BLE zařízení
- Rozvržení, jednotky a vzhled
- Kalibrace: korekce směru větru a magnetická deklinace
- Poslední známý stav spojení

#### Data relace

- Nedávná plavební data pro plynulé animace
- Body grafů a trendů
- Aktuální stav BLE spojení

#### Implementace

```typescript
// app/src/utils/storage.ts
// app/src/hooks/useSailingStorage.ts
```

### ⚡ Úložiště firmwaru ESP32

Trvalé nastavení používá EEPROM/NVS (Non-Volatile Storage).

#### Nastavení EEPROM/NVS

- Kalibrační hodnoty snímačů
- Síťové údaje Wi-Fi, pokud se používají
- Název BLE zařízení a údaje párování
- Korekce směru větru a kompasu

#### Flash

Návrh zahrnuje prostor pro OTA aktualizace a souborové úložiště. Rezervované místo samo o sobě neznamená, že firmware zapisuje plavební protokoly.

#### Rozdělení flash

Rozdělení definuje [`partitions.csv`](https://github.com/veetrlabs/veetr/blob/main/partitions.csv):

- **`nvs`:** `0x5000` = 20 KB
- **`otadata`:** `0x2000` = 8 KB
- **`app0`:** `0x150000` = 1 376 256 B (asi 1,31 MiB)
- **`app1`:** `0x150000` = 1 376 256 B (asi 1,31 MiB)
- **`spiffs`:** `0x150000` = 1 376 256 B (asi 1,31 MiB)

S OTA se firmware musí vejít do jednoho aplikačního oddílu. Nevyužité místo v `app0` či `app1` není bez změny tabulky oddílů dostupné pro záznamy.

#### Implementace

```cpp
// firmware/src/main.cpp
// Přístup k NVS pomocí knihovny Preferences
```

## Tok dat

### Živá data

1. **Snímače ESP32** ([hardware](/cs/docs/hardware/)) → **BLE** → **webový panel**.
2. Prohlížeč zajišťuje okamžité zobrazení a krátkodobé vyrovnávací paměti.
3. Historie snímačů se ukládá v IndexedDB webové aplikace, nikoli jako živý plavební protokol na ESP32.

### Nastavení

1. **Webové rozhraní** → **BLE příkazy** → **ESP32**.
2. Trvalá paměť ESP32 zachovává nastavení po vypnutí.
3. `localStorage` ukládá předvolby pro rychlou odezvu rozhraní.

## Limity

### Web

- **LocalStorage:** přibližně 5–10 MB na doménu podle prohlížeče.
- **SessionStorage:** přibližně 5–10 MB na relaci panelu.
- **IndexedDB:** úložiště větších dat a historie, kvóta závisí na prohlížeči.

### ESP32

- **NVS:** 20 KB
- **OTA:** 2 × 1 376 256 B (asi 1,31 MiB na oddíl)
- **SPIFFS:** 1 376 256 B pro soubory
- **EEPROM:** 512 bajtů v kompatibilním režimu

### Současné použití

- **NVS / Preferences:** kalibrace, obnovovací interval, název zařízení a souřadnice startovní čáry.
- **SPIFFS:** rezervovaný tabulkou oddílů, firmware jej momentálně nepoužívá pro živé plavební záznamy.
- **Historie snímačů:** IndexedDB webové aplikace.

## Soukromí a uchování

Přímé připojení webového přístrojového panelu a ESP32 používá BLE; tato historie zůstává místně a sama se nenahrává do cloudu.

Pracovní živé vyrovnávací paměti se při obnovení stránky vymažou. Nastavení přetrvává do vymazání. Uložená historie má vlastní automatický úklid; vymazání dat webu ji odstraní.

## Správa nastavení

### Kalibrace

```typescript
interface CalibrationSettings {
  windDirectionOffset: number;    // Korekce směru větru ve stupních
  magneticDeclination: number;    // Místní magnetická deklinace
  heelCalibration: number;        // Nulový náklon
  compassDeviation: number[];     // Tabulka deviace kompasu
}
```

### Nastavení zařízení

```cpp
struct DeviceConfig {
  char deviceName[32];           // Název BLE zařízení
  uint16_t updateRate;           // Interval aktualizace v ms
  bool gpsEnabled;               // Zapnutí GPS
  bool imuEnabled;               // Zapnutí IMU
  float sensorOffsets[8];        // Kalibrační korekce snímačů
};
```

## Záloha a obnova

Webové nástroje pro export/import nastavení pracují s JSON; reset předvoleb vymaže místní nastavení. Dostupnost jednotlivých ovládacích prvků závisí na verzi aplikace.

Firmware může nastavení číst a zapisovat přes BLE; tovární reset odstraní uložené NVS předvolby. Před resetem si zaznamenejte potřebné hodnoty.

## Budoucí rozšíření návrhu

Návrh úložiště počítá s plavebními záznamy a GPS stopami, analýzou rychlosti a větru, volitelným cloudovým zálohováním a exporty GPX, CSV a JSON. Stav těchto funkcí se liší mezi firmwarem, webovým panelem a nativní aplikací.

Technické směry zahrnují kompresi časových řad, automatický úklid, šifrování citlivého nastavení a migrace konfigurace při aktualizacích.

## Soubory implementace

### Webový panel

- `app/src/utils/storage.ts` – pomocné funkce ukládání
- `app/src/hooks/useSailingStorage.ts` – React hook pro plavební data
- `app/src/context/BLEContext.tsx` – spojení a správa BLE dat

### Firmware

- `firmware/src/main.cpp` – hlavní program a ukládání
- Knihovny `Preferences`, `SPIFFS`, `ArduinoJson`
