---
title: Vývoj
description: Nastavení vývojového prostředí Veetr a práce na aplikaci nebo firmwaru.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/DEVELOPMENT.md
---

Postupy pro přispěvatele a vývojáře projektu Veetr. Implementaci ESP32 a BLE protokol popisuje [README firmwaru](https://github.com/veetrlabs/veetr/blob/main/firmware/readme.md).

## Rychlé nastavení ⚡

### 1. Vývojové prostředí

```bash
git clone https://github.com/veetrlabs/veetr.git
cd veetr
code veetr.code-workspace
```

### 2. Úlohy VS Code

Úlohy otevřete přes **Ctrl+Shift+P → Tasks: Run Task** nebo **Terminal → Run Task…**.

- **Web: Dev Server** – vývojový server React
- **Firmware: Build** – sestavení firmwaru ESP32
- **Firmware: Upload** – nahrání do ESP32
- **Firmware: Monitor** – sériový monitor

### 3. Ruční příkazy

```bash
# Webový přístrojový panel
npm install
npm run dev --workspace pwa

# Firmware z kořene repozitáře
pio run
pio run --target upload
pio device monitor
```

Pro nativní aplikaci v `app/` použijte její [README](https://github.com/veetrlabs/veetr/blob/main/app/README.md). Web Veetr je v `veetr.org/` a spustíte jej příkazem `npm run dev --workspace veetr.org`.

## Každodenní vývoj

1. Spusťte vývojový server aplikace.
2. Sestavte firmware úlohou **Firmware: Build** nebo `pio run`.
3. Nahrajte jej úlohou **Firmware: Upload** nebo `pio run --target upload`.
4. Otevřete **Firmware: Monitor** nebo `pio device monitor`.
5. Podržte BOOT (GPIO0) alespoň 1 sekundu pro vyhledávání.
6. Otevřete přístrojový panel a otestujte BLE spojení.

### Organizace kódu

#### Webová aplikace (`/pwa`)

- React, TypeScript a Vite
- Tailwind CSS
- Web Bluetooth API
- PWA pro instalaci na mobilní zařízení

#### Nativní aplikace (`/app`)

- React Native a Expo
- Nativní Bluetooth a poloha telefonu
- Viz [Nativní aplikace](/cs/docs/native-apps/)

#### Firmware ESP32 (`/firmware`)

- Arduino přes PlatformIO
- NimBLE pro Bluetooth Low Energy
- Integrace GPS, IMU a větru ([hardware](/cs/docs/hardware/))
- UART, I2C a RS485

### Monitorování stavu PWA

Webová aplikace obsahuje sledování stavu pro dlouhé plavby, zejména na tabletech s Androidem.

**Automatické funkce:**

- Sledování JavaScript heapu a požadavek úklidu při využití nad 80 %, pokud jej prostředí dovolí.
- Watchdog BLE sleduje odpojení a pokouší se spojení obnovit.
- Relace delší než hodinu mají podrobnější protokolování.
- Kontrola service workeru a integrity mezipaměti.
- Úklid neplatných spojení a prevence úniků paměti.

**Obnova:**

- Automatický úklid paměti a spojení.
- Ruční obnovení PWA a diagnostika.
- Sledování počtu chyb a postupně důraznější možnosti obnovy.
- Podrobné protokoly BLE a PWA pro hledání problémů.

**Implementace:**

- Kontrola každých 60 sekund v samostatném režimu PWA.
- Aktivace jen v instalované PWA, aby se nezatěžoval běžný prohlížeč.
- Ošetření chyb zabraňuje tomu, aby potíže způsobilo samotné monitorování.
- Konzolové výpisy pomáhají ladit stabilitu tabletů.

### Vývojové úlohy

Ve webové aplikaci podle skriptů jejího `package.json`:

```bash
npm run dev       # Vývojový server
npm run build     # Produkční sestavení
npm run preview   # Náhled sestavení
npm run lint      # Kontrola kódu
npm run format    # Formátování
```

Firmware:

```bash
pio run                    # Sestavení
pio run --target upload    # Nahrání
pio device monitor         # Sériový výpis
pio run --target clean     # Vyčištění
pio run --target uploadfs  # Nahrání souborového systému, pokud je potřeba
```

### Testování

**Hardware:** sestavte a nahrajte firmware, tlačítkem BOOT zapněte vyhledávání, připojte webovou aplikaci, ověřte proud dat a příkazy nastavení.

**Web:** spusťte server, testujte v Chrome/Edge s Web Bluetooth, ověřte instalaci PWA, mobilní rozvržení a BLE spojení.

### Kvalita kódu

Před commitem ověřte:

- [ ] Kompilace TypeScriptu prochází.
- [ ] Firmware se sestaví bez chyb.
- [ ] Konzole prohlížeče nehlásí chyby.
- [ ] BLE komunikace funguje.
- [ ] Responzivní rozvržení je ověřené.
- [ ] Dokumentace je aktualizovaná podle potřeby.

Používejte přísný TypeScript, ESLint pro React/TypeScript, Prettier a srozumitelné konvenční zprávy commitů.

### Ladění

**Web:** Chrome DevTools pro Bluetooth, panel Network pro service worker a konzole pro stav BLE a chyby.

**Firmware:** sériový monitor ukazuje snímače a BLE, vestavěná LED stav vyhledávání a watchdog chrání proti zamrznutí.

**Časté problémy:**

- BLE nenalezeno: zapněte vyhledávání ESP32.
- Chyba sestavení: ověřte PlatformIO.
- Web se nepřipojí: použijte HTTPS nebo localhost.
- Chyba snímače: ověřte vodiče a napájení.

### Přispívání

1. Vytvořte fork repozitáře.
2. Založte větev: `git checkout -b feature/amazing-feature`.
3. Proveďte změny a důkladně je otestujte.
4. Vytvořte commit: `git commit -m 'Add amazing feature'`.
5. Odešlete větev: `git push origin feature/amazing-feature`.
6. Otevřete pull request.

Změny procházejí revizí, testy musí uspět, dokumentace musí odpovídat a hardware vyžaduje ověření na zařízení.

### Prostředí

Doporučená rozšíření VS Code: **PlatformIO IDE**, **TypeScript and JavaScript Language Features**, **Tailwind CSS IntelliSense**, **Prettier**, **GitLens**, **Auto Rename Tag** a zvýraznění párů závorek.

Použijte verzi **Node.js** uvedenou v příslušném `package.json` nebo `.nvmrc`, **Python** pro PlatformIO, **Git** a podle systému potřebné USB ovladače ESP32.
