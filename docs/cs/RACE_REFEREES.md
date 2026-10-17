---
title: Rozhodčí
description: Zápis dojezdů, opravy výsledků a ovládání živého sledování závodu.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/RACE_REFEREES.md
---

Rozhodčí působí v přiděleném seriálu. Mohou měnit mapu tratě, přihlášky do rozjížděk, výsledky a jejich zveřejnění a ovládat sledování. O změnu nastavení seriálu, ostatních parametrů závodu, kategorií nebo rozjížděk požádejte správce seriálu.

## Nastavení tratě

Otevřete úpravu závodu a sekci **Trať**. Posuňte a přibližte mapu na závodní oblast a umístěte konce startovní čáry **S1** a **S2**. Pomocí **Přidat značku** vložte bóje nebo otočné body. Jejich polohu upravte tažením nebo zadáním souřadnic.

Seřaďte značky podle pořadí obeplutí a vyberte **Nechat vlevo** nebo **Nechat vpravo**. Mapa ukazuje čísla, šipky směru a startovní čáru. Do poznámek lze uvést kola a další pokyny.

Uložte úpravy závodu. Trať patří závodu a zobrazuje se společně se stopami lodí v **Mapě a záznamu** pro všechny rozjížďky. Pod mapou je seznam souřadnic a **Export GPX**. Přehrávání používá aktuální trať. Veřejnost ji uvidí, jakmile má závod zveřejněnou nebo uzamčenou rozjížďku. Polohy jsou přibližné. Trať odstraníte vymazáním značek, startovní čáry a poznámek a uložením.

### Startovní čára z telefonu

V editoru stůjte na konci rozhodčího a zvolte **Načíst polohu telefonu**, poté **Použít polohu pro konec rozhodčího S1**. Zobrazená přesnost pomáhá určit vhodný okamžik; editor odmítá polohy starší než 15 sekund nebo horší než 50 metrů. Konec S2 lze umístit na mapu, zadat podle souřadnic od člověka u bóje nebo jej tam zaměřit telefonem jiného přiděleného rozhodčího. Úpravy koordinujte a po uložení jiným člověkem editor znovu otevřete.

Pokud polohu bóje neznáte, pro S2 vyberte **Náměr a délka**. Zadejte náměr po směru hodinových ručiček od zeměpisného severu nebo použijte **Namířit na bóji** vedle pole náměru. Telefon držte vodorovně a horní hranou miřte k bóji. Magnetická korekce se určuje automaticky podle polohy. Živý náměr se při otáčení mění; tlačítkem **Zachytit náměr** jej zafixujete. Délka začíná odhadem 250 m a lze ji změnit číselně. S2 je v tomto režimu odhadnutý bod. Úpravou délky jej posouváte po uloženém náměru a poté změnu uložte. Kompas i GPS jsou orientační; systém automaticky neposuzuje přejetí startovní čáry.

Po uložení a synchronizaci vyberte na detailu **Pevná poloha** nebo **Živá poloha telefonu**. Pevný režim používá zaměřenou polohu. Živý režim začne až po stisknutí **Spustit živou polohu rozhodčího**, sdílí polohu jako S1 a aktualizuje nejvýše jednou za pět sekund. Zaměřené S2 zůstává pevné; uložený náměr se nemění, dokud jej znovu nezaměříte. **Zastavit a zafixovat startovní čáru** ponechá poslední uloženou polohu.

Živý režim vyžaduje viditelnou stránku a zapnutou obrazovku. Zastaví se při ztrátě použitelné GPS, konfliktní úpravě tratě nebo opuštění stránky. Pokud závěrečné zafixování nedorazí na server, veřejná stránka označí polohu po 15 sekundách jako zastaralou. Snímače potřebují oprávnění prohlížeče a HTTPS; ruční zadání na mapě a náměru zůstává dostupné.

### Cílová čára

V nastavení **Umístění cílové čáry** je výchozí volba **Stejná jako startovní čára**. Cíl tak sleduje i živé změny polohy startu.

Pro cíl jinde vyberte **Samostatná cílová čára**. Konce **F1** a **F2** umístěte do mapy, zadejte souřadnice nebo na daném místě načtěte a potvrďte polohu telefonu. Oba konce lze posouvat samostatně. Při volbě **Náměr a délka** nastavte F1, směr k F2 od zeměpisného severu a délku v metrech; F2 pak bude odhadovaná poloha. Směr lze zachytit také kompasem telefonu.

Uložením trati cílovou čáru sdílíte a zahrnete do exportu GPX. Samostatný cíl se při posunu startu nemění. Umístění cíle samo nezapisuje výsledky.

## Zápis dojezdů

1. Otevřete přidělený seriál ve [správě závodů](/cs/races/manage/).
2. Otevřete závod a rozjížďku, kterou řídíte.
3. Před startem zkontrolujte přihlášky.
4. V cílovém přehledu klepejte na lodě v pořadí dojezdu.
5. Kde je třeba, zapište stav nedokončení.

Zápis zachycuje celkové pořadí dojezdu. Kategorie používají pořadí uvnitř vybrané kategorie. GPS sledování automaticky nezapisuje oficiální dojezdy.

## Oprava výsledku

Ovládáním výsledků změňte stav, posuňte loď výš nebo vymažte chybný výsledek. Poslední zápis lze vrátit. Po opravě zkontrolujte pořadí; sdílené výsledky lze opravit bez skrytí celého závodu.

Chybějící výsledek není automaticky DNS. DNS, DNF, DSQ, RET nebo OCS zapisujte vědomě. Viz [Bodování a výsledky](/cs/docs/race-scoring/).

## Příprava telefonů

Jachtař se může přidat pomocí přístupu k lodi v přihlášené aplikaci nebo soukromou pozvánkou do seriálu bez účtu. Sdílejte jednu pozvánku pro každou loď přes **Seriál → Flotila → nabídka lodě → Sdílet pozvánku**. Jachtař telefon spáruje jednou, pak vybírá závody a stiskne **Připraven závodit**.

Dokončení sledování zachovává spárování pro další závod. Pozvánku zrušte jen při odebrání přístupu nebo výměně telefonu; zrušení platí pro všechny závody seriálu. Starší odkazy pouze na závod zůstávají omezené na původní závod.

Zkontrolujte flotilu a stav sledování. I připravený telefon potřebuje platnou přihlášku ve zveřejněné rozjížďce a otevřené živé sledování. Odeslání pozvánky polohy nezveřejňuje.

## Spuštění, pozastavení a dokončení sledování

Pokud sledování ještě není připravené, po nastavení času startu použijte **Připravit sledování závodu**. Pomocí **Spustit živé sledování připravených telefonů** povolte připraveným a způsobilým telefonům sdílení. **Pozastavit živé sledování** pozastaví zveřejňování. Po konci použijte **Dokončit sledování závodu**.

Po spuštění zkontrolujte mapu. Stará poloha nebo nedostupný telefon nedokazují, že loď zastavila; může jít o signál, připojení nebo nastavení telefonu. Chybějící aktualizace řešte s posádkou.

## Výpadek připojení

Dojezdy lze v dříve načtené relaci ukládat místně i offline. První přihlášení a cloudové nastavení potřebují připojení. Před zavřením sledujte ukazatele uložení a synchronizace.

Při konfliktu synchronizace nejprve exportujte místní práci a teprve pak zvolte načtení cloudové verze. Bez domluvy by nemělo stejný seriál upravovat více rozhodčích současně.
