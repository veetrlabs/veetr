---
title: "Ochrana osobních údajů"
description: "Zásady ochrany osobních údajů mobilní aplikace Veetr a webu veetr.org."
effectiveDate: "26. září 2026"
---

## 1. Identifikace správce

Správce: Jan Linhart (fyzická osoba)

IČO: 75412551

Město: Praha 6 – Ruzyně

Kontaktní e-mail: veetr@linhart.email

Tyto zásady se vztahují na mobilní aplikaci Veetr a web veetr.org.

## 2. Jaké údaje zpracováváme

Zpracováváme údaje poskytnuté v kontaktních formulářích, například e-mailovou adresu a obsah zprávy. Pokud později zavedeme objednávky nebo dopravu, můžeme zpracovávat jméno, e-mail, telefonní číslo, doručovací adresu a historii objednávek. Zpracováváme také technické údaje získané sledováním, včetně IP adresy a identifikátorů zařízení.

## 3. Účely a právní základy

Osobní údaje zpracováváme za účelem odpovídání na dotazy, poskytování podpory, zasílání newsletteru, analytiky, zlepšování služby a plnění příslušných právních povinností.

## 4. Sledování a cookies

Pro sledování a automatizaci marketingu používáme vlastní instanci Mautic. Data jsou uložena na serverech DigitalOcean v Amsterdamu v Nizozemsku. Analytické sledování se zapne až po přijetí cookies v našem banneru.

Cookies zahrnují nezbytné cookies pro fungování webu a volitelné analytické nebo marketingové cookies používané službou Mautic. Volitelné cookies jsou do udělení souhlasu vypnuté.

## 5. Doba uchování

Osobní údaje uchováváme pouze po dobu nezbytnou ke splnění výše uvedených účelů a právních povinností podle práva EU a České republiky.

Obvyklé doby uchování jsou 3 roky pro komunikaci podpory, do odvolání souhlasu nebo 2 roky neaktivity pro marketingové kontakty a 14 měsíců pro analytická data.

## 6. Příjemci a zpracovatelé

Využíváme poskytovatele služeb včetně DigitalOcean pro vlastní instanci Mautic, Webglobe.cz pro doručování e-mailů přes SMTP, GitHub Pages pro hosting webu a dalších poskytovatelů potřebných pro provoz webu.

## 7. Vaše práva

Máte právo na přístup, opravu, výmaz, omezení zpracování, námitku proti zpracování a v příslušných případech na přenositelnost údajů. Pokud je zpracování založeno na souhlasu, můžete jej kdykoli odvolat.

Pro uplatnění práv nás kontaktujte na veetr@linhart.email.

## 8. Zabezpečení

Ochraně osobních údajů věnujeme pozornost a používáme běžná bezpečnostní opatření. Žádný systém nemůže zaručit úplnou bezpečnost.

## 9. Změny těchto zásad

Tyto zásady můžeme průběžně aktualizovat. Nejnovější verze bude vždy dostupná na této stránce.

## 10. Volitelná diagnostika aplikace Veetr

Mobilní aplikace Veetr nabízí volitelné odesílání diagnostiky pro vyšetřování chyb a spolehlivosti záznamu polohy. Automatické odesílání je ve výchozím stavu vypnuté a zapne se pouze po volbě „Sdílet diagnostické zprávy“ v Nastavení → Poloha a záznam. Místo toho můžete zvolit „Odeslat diagnostickou zprávu“ a povolit jednorázové odeslání bez zapnutí automatického hlášení. Záznam polohy funguje nezávisle na této volbě.

Zprávy obsahují verzi aplikace a sestavení, model hardwaru (nikoli osobní název zařízení), verzi operačního systému, stav aplikace na popředí či pozadí, stav oprávnění k poloze, hlášenou přesnost GPS, dobu od poslední zaznamenané polohy a nahrání, velikost fronty nahrávání, počty restartů GPS a předem určené kategorie chyb. Zprávy z Androidu mohou obsahovat také stav obrazovky a úspory energie, dostupnost poskytovatele polohy a omezené čítače a časové údaje o doručování polohy nativním systémem, úlohách na pozadí, životním cyklu služby a událostech záznamu. Neobsahují souřadnice GPS, trasy, jména, e-mailové adresy, identifikátory účtu nebo závodu, pozvánky, přihlašovací tokeny ani neomezené chybové zprávy či výpisy konzole.

Při zapnutém automatickém sdílení diagnostiky mohou zprávy obsahovat také poslední původní a filtrované hodnoty rychlosti a kurzu GPS, hlášenou nejistotu polohy a rychlosti, zpoždění doručení, klasifikaci pohybu (klid, pohyb nebo neznámý stav), pevně dané důvody filtrování a verzi filtru. Tyto vzorky neobsahují souřadnice, kopie tras ani nepřetržité záznamy akcelerometru či gyroskopu. Každý záznamník uchovává nejvýše 120 posledních vzorků lokálně po dobu nejvýše sedmi dnů; zpráva obsahuje nejvýše 32 vzorků podle limitu velikosti. Jde o nedávný úsek pro diagnostiku, nikoli úplný záznam plavby. Vypnutí sdílení tyto neodeslané vzorky smaže. Jednorázové odeslání zprávy toto rozšířené zaznamenávání nezapne.

Diagnostika Bluetooth zahrnuje nedávné fáze připojení, stav adaptéru a aplikace na popředí či pozadí, časové údaje připojení a senzorů, sílu signálu, verzi firmwaru, podrobnosti opakovaných pokusů a číselné chybové kódy. Nezahrnuje názvy ani identifikátory zařízení Bluetooth, původní chybové zprávy nebo data senzorů. Aplikace uchovává v paměti až 20 technických událostí Bluetooth po dobu nejvýše šesti hodin pro zprávu, kterou se rozhodnete odeslat, nebo pro povolené automatické zprávy.

Tyto zprávy zpracováváme na základě vašeho souhlasu. Automatické zprávy používají náhodný diagnostický identifikátor oddělený od účtu a relace závodu, aby bylo možné spojit technické události ze stejné instalace. Jednorázové zprávy používají samostatný náhodný identifikátor. Zprávy jsou pseudonymní, nikoli zaručeně anonymní. Supabase je zpracovává naším jménem a mohou je prohlížet oprávnění správci Veetr. Běžné hostingové a síťové služby také zpracovávají údaje o připojení, například IP adresy, pro vyřízení požadavků; naše tabulka diagnostických zpráv IP adresy neukládá.

Zprávy se z aktivní diagnostické databáze odstraňují po 30 dnech pomocí úklidu spouštěného každou hodinu. Neodeslané zprávy jsou v telefonu omezené na 100 záznamů a vyprší po sedmi dnech. Nativní čítače Androidu shrnují nejvýše 24 hodin činnosti a sbírají se pouze při zapnutém automatickém hlášení. Vypnutí automatického hlášení zastaví další automatické zprávy, kde je to možné zruší čekající nahrávání a vymaže neodeslané zprávy, nativní čítače a místní automatický diagnostický identifikátor. Již přijaté zprávy podléhají uvedené době uchování; vypnutí je neodvolá. Protokoly infrastruktury a zálohy podléhají samostatným pravidlům uchování a zabezpečení poskytovatele hostingu.

Souhlas můžete odvolat bez dopadu na záznam GPS. Pro přístup k údajům nebo žádost o výmaz kontaktujte veetr@linhart.email a pokud jej máte, přiložte ID zprávy zobrazené po jednorázovém odeslání. Zprávy se nepoužívají pro reklamu ani automatizované rozhodování o vás.

## Sdílení plaveb

Plavby jsou soukromé, dokud se jejich pořizovatel nerozhodne je sdílet. Sdílení nahraje vybranou loď, název plavby, časové údaje, trasu a dostupná data plavebních přístrojů. Volba „Kdokoli s odkazem“ umožní plavbu zobrazit komukoli, kdo odkaz má; volba „Veřejné“ ji navíc zařadí do přehledu plaveb. Diváci nepotřebují účet. Samotné členství v posádce neopravňuje ke zveřejnění plavby zaznamenané někým jiným.

Živé sdílení zahrnuje dosud zaznamenanou trasu a následně nahrávané polohy. Zastavení sdílení zneplatní odkaz, jakmile server požadavek potvrdí. Bez připojení aplikace ukáže, že změna čeká na vyřízení. Ukončení plavby zachová zvolené sdílení a stejný odkaz pro dokončenou trasu. Sdílení můžete kdykoli zvlášť zastavit. Vypnutí odkazu neodstraní kopie, které si diváci už uložili. Smazání místního záznamu nesmaže nahranou kopii.

## Mobilní účty, poloha a sdílení při závodě

Přístroje využívající GPS telefonu a místní záznam plavby nepotřebují účet. S vaším svolením aplikace zpracovává přesnou polohu, časové údaje, rychlost, kurz a hlášenou přesnost pro zobrazení plavebních dat a záznam trasy. Pokud zapnete záznam a udělíte potřebná oprávnění, může pokračovat se zhasnutou obrazovkou nebo na pozadí. Volitelně připojené přístroje poskytují měření, například údaje o větru. Místní záznamy zůstávají v zařízení, dokud nezvolíte nahrávání nebo sdílení; mapové služby nadále přijímají požadavky potřebné pro zobrazení map.

Funkce účtu zpracovávají e-mailovou adresu, přihlašovací údaje, identifikátor účtu a příslušná členství u lodí nebo závodů. Supabase naším jménem zajišťuje přihlašování a ukládá online údaje účtů, plaveb a závodů. Tato data používáme pro poskytnutí požadovaných funkcí účtu a sdílení. Oprávnění správci mají k údajům přístup, pokud je to nutné pro provoz služby nebo řešení požadavku podpory.

Při zapnutí sdílení polohy v závodě aplikace nahrává polohu lodi, časové údaje a dostupná plavební měření. Účastníci, pořadatelé a diváci s přístupem k závodu mohou tyto informace zobrazit; veřejné stránky závodů mohou být dostupné bez přihlášení. Zaznamenané závodní polohy mohou zůstat dostupné pro historii a přehrávání i po ukončení živého sdílení. Zastavení záznamu brání dalšímu sběru v dané relaci; nemaže dříve nahrané záznamy. Účet a nahraná plavební data uchováváme, dokud jsou potřebné pro účet, uložené plavby a historii závodů, pokud nepožádáte o výmaz nebo neplatí zvláštní pravidlo uchování.

Mapy využívají služby třetích stran, například Google Maps na Androidu a Apple Maps na iOS, a poskytovatele map či vrstev uvedené v atribuci mapy. Tito poskytovatelé přijímají technické požadavky včetně údajů o připojení a požadované oblasti mapy podle vlastních zásad ochrany osobních údajů. Veetr vaši polohu neprodává ani nepoužívá pro reklamu.

## Smazání účtu a dat

O smazání účtu a souvisejících osobních údajů můžete požádat prostřednictvím [stránky pro smazání účtu](/cs/legal/delete-account/) nebo e-mailem na veetr@linhart.email. Před provedením ověříme vlastnictví účtu. Můžete také požádat o smazání konkrétních nahraných dat bez smazání účtu. Stránka pro smazání vysvětluje rozsah, místní záznamy, samostatně identifikovanou diagnostiku a případné výjimky z výmazu. Odhlášení nebo odinstalování aplikace váš online účet nesmaže.
