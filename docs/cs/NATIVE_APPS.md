---
title: Nativní aplikace
description: Jak aplikace Veetr pro iPhone a Android připojují přístroje, zaznamenávají plavby a podporují závodění.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/NATIVE_APPS.md
---

Nativní aplikace Veetr přinášejí jachtařské přístroje, záznam plaveb a závodní tratě na **iPhone a Android**. Zaznamenávejte pouze pomocí GPS telefonu nebo připojte Veetr Vane přes Bluetooth pro údaje o větru a další měření.

Aplikace jsou zatím dostupné v beta testování na pozvánku. O přístup požádejte podle **[ukázek a pokynů k instalaci](/cs/docs/mobile-apps/)**.

## Pět záložek

| Záložka | Funkce |
| --- | --- |
| **Data** | Jachtařské přístroje: rychlost, vítr, směr, náklon a vzdálenost k nastavené startovní čáře. Hodnoty závisí na dostupných datech GPS a přístrojů. |
| **Mapa** | Poloha a stopa lodě, styly mapy, námořní značky a trať připojeného závodu. |
| **Záznam** | Spuštění soukromého GPS záznamu a seznam uložených plaveb. Otevřením plavby zobrazíte trasu a naměřené údaje. |
| **Závody** | Otevření pozvánek pro loď, výběr závodu v seriálu a příprava na start. |
| **Nastavení** | Účet, Bluetooth, kalibrace, poloha, zobrazení, startovní čára a hlídání kotvy. |

## GPS telefonu a Veetr Vane

GPS telefonu poskytuje polohy pro záznam bez dalšího hardwaru. Na výzvu povolte přístup k poloze; záznam se zamčenou obrazovkou závisí také na oprávnění k poloze na pozadí a úsporných nastaveních telefonu.

V nastavení Bluetooth připojte Veetr Vane a přidejte jeho měření. Bluetooth se připojuje přímo k jednotce a nepotřebuje podporu Web Bluetooth v prohlížeči. Vítr a další přístrojové hodnoty zůstávají nedostupné, pokud chybí jejich zdroj dat.

## Záznam a prohlížení plaveb

V **Záznamu** spusťte nahrávání a po skončení plavby jej zastavte. Uložené plavby obsahují trasu a zaznamenané hodnoty; grafy větru vyžadují, aby se během plavby zaznamenávala data o větru.

Soukromé záznamy zůstávají v telefonu, dokud je nezačnete sdílet. Živé sdílení a odkazy na plavby používají online služby a vyžadují účet. Výběr viditelnosti, nahrávání a sdílení dokončené plavby popisuje **[návod k záznamu a sdílení](/cs/docs/share-your-trip/)**.

## Připojení k závodu

Otevřete pozvánku pro svou loď, spárujte telefon se seriálem, vyberte závod a stiskněte **Připraven závodit**. Spárování přes pozvánku nevyžaduje účet.

Zveřejněná trať připojeného závodu se zobrazí na mapě včetně konců startovní čáry a číslovaných otočných bodů. Závodní záznamy uchovávají snímek tratě pro pozdější prohlížení; starší záznamy bez uložené tratě ji automaticky nezískají.

Účast popisuje **[návod pro závodníky](/cs/docs/race-skippers/)**, přípravu a správu tratí na webu **[návod pro rozhodčí](/cs/docs/race-referees/)**.

## Startovní čára a kotva

V **Nastavení** otevřete nastavení startovní čáry a pomocí GPS telefonu zachyťte levý a pravý konec. Pořadí je libovolné. Čára se ukládá do telefonu a nemění trať zveřejněnou rozhodčím.

Hlídání kotvy umožňuje nastavit polohu kotvy, délku řetězu a rezervu a spustit sledování. Než se spolehnete na upozornění, zkontrolujte oprávnění k poloze a oznámením a vyzkoušejte zvuk alarmu. Telefon musí zůstat napájený a schopný získávat polohu.

Tyto ovládací prvky ukazují **[snímky startovní čáry a kotvy](/cs/docs/mobile-apps/#start-line-and-anchor-tools)**.

## Místní a online funkce

Bluetooth připojení přístrojů a místní záznam nepotřebují nepřetržitý internet. Dosud nenačtené oblasti mapy, aktualizace závodů, pozvánky a sdílení internet vyžadují. Pokud nahrávání čeká, před odstraněním místního záznamu se připojte a otevřete Veetr, aby se dokončilo.

Záznamy nativní aplikace a historie webového přístrojového panelu jsou oddělená úložiště. Instalace aplikace neimportuje historii prohlížeče.

## Zdrojový kód a vývoj

Nativní aplikace je v [`app/`](https://github.com/veetrlabs/veetr/tree/main/app) a používá React Native a Expo. Webový přístrojový panel je v [`pwa/`](https://github.com/veetrlabs/veetr/tree/main/pwa).

Postup nastavení a práce se simulátorem uvádí [README mobilního vývoje](https://github.com/veetrlabs/veetr/blob/main/app/README.md). Bluetooth, GPS a záznam na pozadí zkoušejte na skutečném telefonu; simulátor tyto funkce zařízení neověří.
