---
title: Krabička a upevnění
description: Tisk, sestavení, upevnění, sejmutí a údržba krabičky Veetr.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/ENCLOSURE.md
---

Krabička Veetr chrání jednotku a udržuje její opakovatelnou polohu. Zároveň ji lze snadno sejmout pro nabíjení, aktualizace či servis.

<a href="https://www.printables.com/model/1589439-veetr-box"><img src="/img/3d-veetr-box.png" alt="CAD model krabičky Veetr s otevřeným víkem" width="1832" height="1126" loading="lazy"></a>

## Model ke stažení

**[Krabička Veetr na Printables](https://www.printables.com/model/1589439-veetr-box)** obsahuje aktuální modely a informace k tisku.

Před tiskem ověřte poslední revizi. Všechny díly používejte z jedné odpovídající sady: změny krabičky, víka, pantu, lišty nebo posuvných částí mohou ovlivnit jejich vzájemnou shodu.

## Odnímatelné upevnění

Krabička používá samostatnou montážní lištu:

1. Přišroubujte lištu na stěnu, přepážku nebo jinou vhodnou rovnou plochu.
2. Zarovnejte vytištěné nožky krabičky s lištou.
3. Zasuňte krabičku až na doraz.
4. Při sejmutí ji podepřete a vysuňte zpět podél lišty.

Lišta vrací krabičku pokaždé do stejné polohy a orientace. To je důležité pro IMU měřící směr a náklon: po servisu nebo nabíjení se jednotka vrátí na původní místo.

Použijte šrouby a přípravu odpovídající podkladu. Lišta musí být pevná, s dostatkem místa pro vysunutí. Podle potřeby utěsněte montážní otvory proti vodě. Pokud změníte polohu lišty nebo usazení krabičky, zkontrolujte kalibraci.

## Imbusový klíč jako čep pantu

Čepem pantu víka je **imbusový klíč**. Jeho dlouhé rameno prochází zarovnanými částmi pantu a tvoří osu otáčení.

Má dvě funkce:

- Umožňuje běžné otevírání víka.
- Zůstává u krabičky jako nástroj pro její rozebrání.

Při servisu vytáhněte klíč z pantu a použijte jej na spojovací materiál. Vytažením zároveň uvolníte víko. Po sestavení vraťte klíč skrz všechny části pantu a ověřte volný pohyb bez násilného ohýbání tištěných dílů.

Použijte velikost klíče určenou aktuálním modelem. Neprotlačujte větší klíč a nenahrazujte jej trvalým čepem, pokud chcete mít nástroj stále u krabičky.

## Konektory a ovladače víka

Při pohledu na zapuštěný panel jsou otvory zleva doprava:

| Pozice | Otvor | Připojení |
| --- | --- | --- |
| 1 | Obdélníkový | RJ45 pro ultrazvukový snímač větru |
| 2 | Malý kruhový | Externí Bluetooth anténa |
| 3 | USB-C | Napájení, nabíjení a programování firmwaru |
| 4 | Velký kruhový | Externí GPS anténa |

USB-C je otvor pro zásuvku, nikoli trvale připevněný kabel.

Dva pružné ovladače vytištěné ve víku mačkají tlačítka ESP32:

- **Reset** mačká reset/EN.
- **Párování** mačká BOOT a otevírá časové okno vyhledávání.

Před zavřením zkontrolujte zarovnání s tlačítky a volný návrat obou ovladačů.

## Kontrola tisku a rozměrů

- Dodržte orientaci a pokyny k tisku na Printables.
- Použijte krabičku, víko, pant, lištu a nožky stejné revize.
- Opatrně odstraňte podpěry a očistěte kluzné plochy i pant; nadměrně je nezvětšujte.
- Před montáží vyzkoušejte lištu. Krabička má držet pevně, ale zasouvat se bez velké síly.
- Před konečným sestavením nasucho vyzkoušejte PCB a všechny konektory.
- Ověřte prostor pro antény, RJ45 a USB-C kabel.
- Víko nesmí tlačit na desku, moduly ani vodiče.

## Servis a sejmutí

1. Odpojte napájení a kabely externích snímačů a antén.
2. Podepřete krabičku a vysuňte ji z lišty.
3. Přesuňte ji na čisté a suché pracoviště.
4. Vyjměte imbusový klíč z pantu a otevřete krabičku.
5. Po servisu vraťte víko a klíč a zasuňte krabičku až na doraz.
6. Připojte kabely a před použitím ověřte měření.

Krabička a držák jsou prototypové díly. Odolnost proti vodě, UV záření, pevnost a dlouhodobá rozměrová stálost závisejí na materiálu, kalibraci tiskárny, montáži a testování. Nejde o certifikované námořní bezpečnostní zařízení.
