---
title: "Bodování a výsledky"
description: "Body rozjížděk, počáteční body závodů, škrtání a průběžné pořadí."
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/RACE_SCORING.md
---

Veetr používá bodování, ve kterém je méně bodů lepší. Nastavení dohodněte před závodem a ověřte s rozhodčím.

## Od rozjížděk k seriálu

Dojezdy zapisujte v jednotlivých rozjížďkách. Pořadí závodu kombinuje body rozjížděk po případném škrtání. U závodů počítaných z rozjížděk se umístění lodě převádí na body do seriálu:

**Body za závod do seriálu = umístění v závodě − 1 + počáteční body**

Výchozí **Počáteční body** závodu jsou 0:

| Umístění | Výchozí: 0 | Závod začínající na −1 |
| --- | --- | --- |
| 1. | 0 | −1 |
| 2. | 1 | 0 |
| 3. | 2 | 1 |

Pokud to odpovídá dohodnutému pravidlu, nastavte u 24hodinového závodu −1. Nastavení patří jen závodu. Rozjížďky mají stejnou váhu; není zde nastavení váhy rozjížďky ani dvojí započtení závodu „×2“.

Importované souhrnné výsledky používají importované body, nevymýšlejí dojezdy jednotlivých rozjížděk. Před použitím porovnejte importované pořadí s původními výsledky.

## Kategorie a všechny lodě

Přehled všech lodí boduje celkové pořadí dojezdu. Vybraná kategorie boduje umístění uvnitř kategorie a pro penalizace používá počet přihlášených v ní. Přepnutí kategorie tak může změnit pořadí i body, aniž by se změnil celkový zápis dojezdů.

Tento model nepočítá handicap ani korigované časy.

## Chybějící výsledky a nedokončené plavby

Stavy DNS, DNF, DSQ, RET a OCS zapisujte záměrně. Výchozí penalizace je příslušný počet přihlášených plus jedna.

Chybějící výsledek se automaticky nemění na DNS. Loď bez výsledku může zůstat nezařazená. I proto je živé pořadí předběžné.

## Škrtání

Škrtání rozjížděk nastavte v závodě, škrtání závodů v seriálu. Bez pravidla se nic neškrtá.

Prahy rozjížděk počítají dokončené rozjížďky; prahy seriálu počítají závody označené jako dokončené. Například „škrtnout 1 po 4 dokončených závodech“ po dosažení prahu vyřadí jeden způsobilý nejhorší výsledek závodu.

Škrtnuté výsledky zůstávají viditelné přeškrtnuté, ale nejsou v započteném součtu.

## Shody a opravy

Při shodě se porovnává součet započtených bodů, pak započtené výsledky od nejlepšího k nejhoršímu a nakonec výsledky od posledního závodu zpět. Pokud shoda trvá, lodě sdílejí pořadí.

Rozhodčí mohou opravit výsledky i po zveřejnění. Časy sledování a polohy na mapě nenahrazují oficiální zápis dojezdu. Postup popisuje návod [Rozhodčí](/cs/docs/race-referees/).
