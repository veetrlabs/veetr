---
title: Nastavení PlatformIO
description: Sestavení, nahrání, sledování a řešení problémů firmwaru Veetr pomocí PlatformIO.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/PLATFORMIO.md
---

Projekt používá PlatformIO pro vývoj firmwaru ESP32 se společným nastavením v kořeni repozitáře.

## Struktura projektu

```text
veetr/
├── platformio.ini           # Nastavení PlatformIO
├── firmware/
│   ├── src/                 # Zdrojové kódy
│   ├── include/             # Hlavičkové soubory
│   ├── lib/                 # Vlastní knihovny
│   └── test/                # Testy
└── .vscode/
    └── tasks.json           # Úlohy VS Code
```

## Podrobnosti nastavení

### Cílový hardware

- **Deska:** ESP32 DevKitC WROOM-32U ([podrobnosti](/cs/docs/hardware/))
- **Platforma:** Espressif32 v6.4.0+
- **Framework:** Arduino
- **Sériový monitor:** 115200 baud

### Knihovny

- **ArduinoJson** v6.21.2+ – serializace JSON
- **SparkFun BNO080** – IMU a orientace
- **TinyGPSPlus** v1.0.3+ – parsování GPS
- **ModbusMaster** v2.0.1+ – komunikace RS485
- **NimBLE-Arduino** v1.4.2+ – Bluetooth Low Energy

### Přepínače sestavení

- **Ladění:** úroveň 1, minimální výstup
- **PSRAM:** podpora přídavné paměti
- **Optimalizace:** `-Os`, optimalizace velikosti
- **BLE:** nejvýše 4 připojení, omezené protokolování

## Vývojový postup

Celé nastavení prostředí a každodenní práci popisuje **[Vývoj](/cs/docs/development/)**. Tato stránka se zaměřuje na PlatformIO.

## Příkazy sestavení

Spouštějte z kořene repozitáře, ne z podadresáře firmware:

```bash
pio run                    # Sestavení firmwaru
pio run --target upload    # Nahrání do ESP32
pio device monitor         # Sériový monitor
pio run --target clean     # Odstranění sestavených souborů
```

## Integrace IDE

Pro práci s firmwarem ve VS Code:

```bash
cd firmware && code .
```

Otevře se adresář firmwaru. Společné nastavení PlatformIO je v kořeni projektu.

## Využití paměti

Referenční měření firmwaru:

- **RAM:** 11,6 % (38 076 / 327 680 bajtů)
- **Flash:** 52,1 % (683 397 / 1 310 720 bajtů)

Jde o orientační hodnoty konkrétního sestavení; aktuální využití zkontrolujte ve výstupu kompilace. Další snímače uvádí [Hardware](/cs/docs/hardware/).

## Přidání knihovny

Upravte `platformio.ini`:

```ini
lib_deps =
    bblanchon/ArduinoJson @ ^6.21.2
    # ... stávající knihovny ...
    your-new-library @ ^1.0.0
```

Znovu sestavte tlačítkem **⚡ FW Build** nebo `pio run`.

## Ladění

### Sériový monitor

- Tlačítko **📺 Monitor** ve VS Code nebo `pio device monitor`
- Rychlost 115200 baud

### Ladicí výstup

Úroveň nastavte v `platformio.ini`:

```ini
build_flags =
    -DCORE_DEBUG_LEVEL=3    # 0=vypnuto, 1=chyby, 2=varování, 3=informace, 4=ladění, 5=podrobně
```

## Řešení problémů

### Nahrávání

1. Zkontrolujte USB kabel.
2. Ověřte nalezený port.
3. Podle potřeby při nahrávání stiskněte reset ESP32.
4. Vyzkoušejte jiný kabel nebo port.

### Chyby sestavení

1. Vyčistěte sestavení tlačítkem **🧹 Clean** nebo `pio run --target clean`.
2. Aktualizujte PlatformIO pomocí `pio update`.
3. Ověřte kompatibilitu knihoven v `platformio.ini`.

### Knihovny

1. Aktualizujte knihovny: `pio lib -g update`.
2. Pro přeinstalaci odstraňte `.pio/libdeps/` a znovu sestavte.

## Pokročilé nastavení

### Vlastní prostředí

Přidejte do `platformio.ini`:

```ini
[env:debug]
board = esp32doit-devkit-v1
build_flags =
    -DCORE_DEBUG_LEVEL=5
    -DDEBUG_MODE=1

[env:production]
board = esp32doit-devkit-v1
build_flags =
    -DCORE_DEBUG_LEVEL=0
    -Os
```

### OTA

Příklad síťové OTA konfigurace pro firmware, který takové nahrávání podporuje:

```ini
upload_protocol = espota
upload_port = 192.168.1.100  # IP adresa ESP32
```

Běžný uživatelský BLE aktualizátor popisuje [Aktualizace firmwaru](/cs/docs/firmware-update/).

## VS Code

Projekt nabízí integraci **PlatformIO IDE**, doplňování pro ESP32 Arduino, IntelliSense pro knihovny a tlačítka běžných úloh, takže můžete pracovat v jednom prostředí.
