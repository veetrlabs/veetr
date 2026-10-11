---
title: Shoda a certifikace
description: Regulační souvislosti a certifikace hardwaru Veetr Vane.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/COMPLIANCE.md
---

> **Důležité:** Stránka popisuje současné porozumění projektu. Nejde o právní, regulační, technické ani certifikační poradenství.

Dokument shrnuje informace o shodě a certifikacích Veetr Vane. Údaje o modulu níže **nejsou certifikací hotového zařízení Veetr Vane**.

## Certifikace modulu ESP32

Systém je založen na ESP32-WROOM-32U. Dokumentace projektu uvádí následující certifikace modulu:

### FCC (Spojené státy)

- **FCC ID:** 2AC7Z-ESP32WROOM32U
- **Modul:** ESP32-WROOM-32U
- **Výrobce:** Espressif Systems
- **Shoda:** FCC Part 15, Subpart C (15.247)
- **Frekvence:** 2,412–2,484 GHz (Wi-Fi/Bluetooth)

### IC (Kanada)

- **IC ID:** 21098-ESP32WROOM32U
- **Modul:** ESP32-WROOM-32U
- **Shoda:** RSS-247 Issue 2

### CE (Evropská unie)

- **Modul:** ESP32-WROOM-32U
- **Normy:** EN 300 328, EN 301 489, EN 62479
- **Směrnice:** 2014/53/EU, Radio Equipment Directive (RED)

## Regulační shoda

Základem návrhu jsou existující certifikace modulu: FCC ID 2AC7Z-ESP32WROOM32U, IC ID 21098-ESP32WROOM32U a shoda s RED 2014/53/EU.

### Přístup k posuzování

**Pro vlastní stavbu:**

- Používejte certifikované moduly ESP32-WROOM-32U s platným označením.
- Dodržte referenční návrh a určené antény.
- Ověřte místní pravidla pro elektroniku k osobnímu použití; případná výjimka závisí na konkrétních podmínkách.

**Pro komerční stavebnice:**

- Ověřte použití modulu přesně podle podmínek jeho certifikace.
- Významné úpravy nebo cílový trh mohou vyžadovat další posouzení.
- Požadavky jednotlivých trhů se liší; certifikovaný modul sám o sobě necertifikuje celý výrobek.

Otevřený hardwarový projekt **neposkytuje certifikace výrobku**. Za shodu postavených nebo prodávaných jednotek odpovídá jejich zhotovitel či prodejce.

## Prohlášení FCC pro modul

### USA – FCC Part 15

Referenční znění k modulu uvádí dvě podmínky provozu:

1. Zařízení nesmí způsobovat škodlivé rušení.
2. Musí přijmout veškeré rušení, včetně takového, které může způsobit nežádoucí provoz.

**Upozornění FCC:** změny výslovně neschválené stranou odpovědnou za shodu mohou zrušit oprávnění zařízení provozovat.

**Vystavení rádiovému záření:** referenční podmínky pro nekontrolované prostředí uvádějí minimální vzdálenost 20 cm mezi zářičem a tělem.

**Modulární schválení:** uvedený modul má FCC ID 2AC7Z-ESP32WROOM32U. Podmínky modulu je nutné ověřit pro konkrétní sestavu.

## Kanada – IC

### Innovation, Science and Economic Development Canada (ISED)

Referenční podmínky pro rádiové zařízení bez licence:

1. Zařízení nesmí způsobovat rušení.
2. Musí přijmout veškeré rušení včetně takového, které může způsobit nežádoucí provoz.

**IC:** dokumentace modulu odkazuje na limity vystavení záření IC RSS-102 pro nekontrolované prostředí.

**Původní francouzské znění (Kanada):**

Le présent appareil est conforme aux CNR d'Industrie Canada applicables aux appareils radio exempts de licence. L'exploitation est autorisée aux deux conditions suivantes:
1. L'appareil ne doit pas produire de brouillage
2. L'utilisateur de l'appareil doit accepter tout brouillage radioélectrique subi, même si le brouillage est susceptible d'en compromettre le fonctionnement

## Další poznámky

### Otevřený hardware

- Návrhy, schémata a kód jsou otevřené.
- Jednotlivci mohou stavět podle zveřejněných podkladů.
- Certifikované ESP32 moduly pořizujte od autorizovaných dodavatelů.
- Pravidla a výjimky pro osobní použití ověřte v dané zemi.

### Komerční prodej

- Prodejci musí zajistit odpovídající posouzení pro svůj trh.
- Výrobce odpovídá za kvalitu součástek a ověření shody.
- Je třeba poskytnout dokumentaci shody a montážní pokyny.
- Prodej zahrnuje technickou podporu a příslušné záruční povinnosti.

### Rozsah posouzení

- Návrh využívá předem certifikovaný modul ESP32-WROOM-32U.
- Další snímače GPS, IMU a větru je třeba posoudit jako součást celku.
- Používá se externí 5V USB-C napájení; ani to nenahrazuje posouzení celé sestavy.
- Antény musí odpovídat podmínkám certifikace modulu.

### Rozdíly mezi zeměmi

Jednotlivé země mohou mít další požadavky. Ověřte je u příslušných orgánů; některé trhy mohou vyžadovat místního zástupce nebo registraci dovozce.

## Omezení odpovědnosti

**Dokument slouží pouze jako reference.** Projekt Veetr:

- **Neposkytuje certifikaci** hotových zařízení.
- **Odkazuje pouze** na existující certifikace modulu ESP32.
- **Je otevřeným návrhem**; za shodu odpovídají zhotovitelé.
- **Nezaručuje shodu** odvozených návrhů a úprav.

**Při stavbě nebo prodeji Veetr Vane:**

1. Ověřte aktuální certifikace součástek.
2. Zajistěte nezávislé právní a regulační posouzení.
3. Získejte potřebné certifikace pro komerční prodej.
4. Dodržte místní předpisy.
5. Používejte certifikované součástky odpovídající referenčnímu návrhu.

Nejde o právní radu. Požadavky závisejí na zemi a použití. Uvedené certifikace patří společnosti Espressif Systems, nikoli projektu Veetr.

## Zdroje

- [Datasheet ESP32-WROOM-32U](https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32d_esp32-wroom-32u_datasheet_en.pdf)
- [Vyhledávání schválení FCC](https://apps.fcc.gov/oetcf/eas/reports/GenericSearch.cfm)
- [Vyhledávání v ISED Spectrum Management System](https://ised-isde.canada.ca/site/spectrum-management-system/en/search-sms-data)
- [Evropská směrnice RED](https://single-market-economy.ec.europa.eu/sectors/electrical-and-electronic-engineering-industries-eei/radio-equipment-directive-red_en)
