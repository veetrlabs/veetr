---
title: Aktualizace firmwaru
description: Instalace, ověření a řešení problémů s aktualizacemi firmwaru Veetr.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/FIRMWARE_UPDATE.md
---

Tento návod popisuje aktualizaci firmwaru Veetr na nejnovější verzi.

## 🔄 Automatická aktualizace (doporučeno)

Nejjednodušší je vestavěná bezdrátová aktualizace OTA ve webovém přístrojovém panelu:

1. **Připojte ESP32** přes Bluetooth ve webové aplikaci.
2. Otevřete **Nastavení → Aktualizace firmwaru**.
3. Klikněte na **Zkontrolovat aktualizace**.
4. Pokud existuje novější verze, klikněte na **Aktualizovat firmware**.
5. **Počkejte na dokončení** a během aktualizace se neodpojujte.

## 📦 Ruční instalace

Pokud automatická aktualizace nefunguje nebo dáváte přednost ruční instalaci:

### Význam souborů

Stažené vydání obsahuje několik souborů:

- **`veetr-X.X.X.bin`** – binární firmware pro nahrání do ESP32.
- **`veetr-X.X.X.elf`** – ladicí symboly, potřebné jen při vývoji a ladění pádů.
- **`firmware-info.json`** – metadata sestavení: verze, datum, velikost a další údaje.

**Běžný uživatel potřebuje pouze soubor `.bin`.**

### Možnost 1: ESPTool (doporučeno)

1. **Stáhněte firmware** ze [stránky vydání](https://github.com/veetrlabs/veetr/releases).
2. **Nainstalujte ESPTool**, pokud jej ještě nemáte:
   ```bash
   pip install esptool
   ```
3. **Připojte ESP32** k počítači přes USB.
4. **Nahrajte firmware**:
   ```bash
   esptool.py --port /dev/ttyUSB0 write_flash 0x10000 veetr-X.X.X.bin
   ```

   > Nahraďte `/dev/ttyUSB0` skutečným portem. Ve Windows to může být `COM3`, na macOS `/dev/tty.usbserial-*`.

### Možnost 2: PlatformIO

Pokud máte zdrojové kódy a PlatformIO:

1. Naklonujte repozitář:
   ```bash
   git clone https://github.com/veetrlabs/veetr.git
   cd veetr
   ```
2. Přepněte na požadovanou verzi:
   ```bash
   git checkout X.X.X  # Nahraďte tagem požadované verze
   ```
3. Nahrajte do ESP32:
   ```bash
   pio run --target upload
   ```

## 🔍 Ověření

Po aktualizaci ověřte verzi:

1. Připojte se k webovému přístrojovému panelu.
2. Otevřete **Nastavení → Informace o systému**.
3. Zkontrolujte zobrazenou verzi firmwaru.

## ⚠️ Řešení problémů

### Aktualizace selhala

- Ověřte připojení ESP32 přes Bluetooth.
- Obnovte stránku aplikace.
- Zkontrolujte dostatek energie v baterii nebo napájení.
- Vyzkoušejte ruční instalaci.

### Problémy s připojením

- Zapněte Bluetooth na svém zařízení.
- **Aktivujte režim vyhledávání:** podržte tlačítko BOOT (GPIO0) alespoň 1 sekundu.
- Rozsvícená vestavěná LED (GPIO2) potvrzuje aktivní vyhledávání.
- Vymažte mezipaměť prohlížeče a zkuste to znovu.
- Ověřte, že je ESP32 zapnuté a v režimu vyhledávání (LED svítí).

### Problémy s ruční instalací

- Ověřte správný port/COM pro ESP32.
- Ujistěte se, že sériový port nepoužívá jiný program.
- Při připojování zkuste stisknout tlačítko BOOT na ESP32.

## 📞 Podpora

1. Zkontrolujte známé problémy v [Issues](https://github.com/veetrlabs/veetr/issues).
2. Vytvořte nové hlášení s popisem problému.
3. Uveďte verzi firmwaru, typ zařízení a chybové zprávy.

**Před aktualizací firmwaru vždy zálohujte nastavení!**
