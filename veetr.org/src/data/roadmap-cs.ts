import { milestones as original, type MilestoneState } from './roadmap';
export const stateLabels: Record<MilestoneState, string> = {
  done: 'Hotovo', 'in-progress': 'Probíhá', planned: 'Plánováno',
};
const translations = [
  {title:'Hardwarový prototyp',text:'První prototyp na nepájivém poli propojil senzory a elektroniku: výchozí bod, na kterém šlo stavět, měřit a učit se.',alt:'První propojený prototyp Veetr na nepájivém poli se senzorovými moduly',caption:'První propojený prototyp'},
  {title:'Vývoj firmwaru',text:'Číst senzory, zpracovávat měření a odesílat plavební data ze zařízení.',alt:'Zdrojový kód firmwaru Veetr v editoru s obsluhou událostí připojení Bluetooth',caption:'Vývoj firmwaru · události Bluetooth'},
  {title:'Webová aplikace PWA',text:'Vytvořit progresivní webovou aplikaci, která ukáže data zařízení v telefonu nebo tabletu přímo v prohlížeči.',alt:'Webová aplikace Veetr s přístroji pro vítr, rychlost, kurz a náklon bez připojeného zařízení',caption:'Živá PWA · bez připojeného zařízení'},
  {title:'Vlastní plošný spoj',text:'Nahradit volné vodiče prototypu vlastní deskou plošných spojů a omezit rozpojování při manipulaci.',alt:'Černá deska plošných spojů Veetr před osazením součástek',caption:'Vlastní plošný spoj'},
  {title:'OTA · Bezdrátové aktualizace firmwaru',text:'Stáhnout vydání firmwaru z GitHubu do telefonu a odeslat jej do zařízení Veetr Vane přes Bluetooth Low Energy (BLE). Aktualizovat zařízení bez připojení k počítači.'},
  {title:'Vlastní krabička z 3D tisku',text:'Dát elektronice praktickou krabičku pro upevnění, manipulaci a testování prototypu.',alt:'Modrá krabička Veetr z 3D tisku s kabely a externí anténou',caption:'První krabička z 3D tisku'},
  {title:'Ověření konceptu',text:'Testování potvrdilo, že nápad může fungovat, a ukázalo slabiny prvního prototypu.',note:'Co jsme zjistili: displeje se špatně četly, PWA přestala zaznamenávat při zhasnutí obrazovky a Bluetooth se muselo pokaždé párovat.',alt:'Veetr na upevněném tabletu na plachetnici s odlesky na obrazovce',caption:'Testování prvního prototypu na vodě'},
  {title:'Nový hardwarový prototyp',text:'Vznikl nový prototyp s reflexním LCD displejem, úložištěm na SD kartě a bateriovým napájením, aby zařízení mohlo samo zobrazovat a zaznamenávat data.',alt:'Prototyp Veetr s reflexním LCD v průhledné krabičce, externí GPS anténou a prototypovým zapojením',caption:'Prototyp s reflexním LCD na lodi'},
  {title:'Správa závodů',text:'Zjednodušit administrativu našemu rozhodčímu a usnadnit sledování závodů jachtařům i divákům.'},
  {title:'Mobilní aplikace pro iOS a Android',text:'Ve výchozím stavu využívat GPS telefonu. Připojit Veetr Vane pro rychlost a směr větru a externí zdroj GPS.',note:'Cíl: spolehlivé opětovné připojení a záznam se zhasnutou obrazovkou. Případné zlepšení přesnosti GPS je nutné změřit v reálných podmínkách.'},
  {title:'Živé polohy při závodě',text:'Umožnit jachtařům sdílet polohu během závodu s přehledným ovládáním sdílení a užitečným pohledem pro diváky. Otestovat výpadky pokrytí a zpožděné aktualizace.'},
  {title:'Skutečné závody. První uživatelé.',text:'Nasadit systém při skutečných závodech s prvními uživateli. Pozorovat přípravu, záznam a správu závodů a opravit to, co překáží.'},
  {title:'Ověření poptávky a uplatnění',text:'Zjistit, kdo Veetr potřebuje natolik, aby jej používal opakovaně. Začít rozhovory už teď a před rozhodnutím o výrobě ověřit poptávku opakovanými zkouškami.',note:'Co chceme ověřit: jachtaři se vracejí na další závod, kluby se zavazují k pilotnímu provozu a lidé mají zájem koupit za realistickou cenu. Samotné přihlášení k newsletteru poptávku neprokazuje.'},
  {title:'Založení Veetr s.r.o.',text:'Založit společnost a připravit praktické základy výroby, zákaznické podpory a prodeje hotového produktu.'},
  {title:'Návrh výrobního zařízení',text:'Tam, kde to dává smysl, využít certifikované součástky, zlepšit funkce a dokončit výrobní návrh.',note:'Plánovat shodu s předpisy včas: ověřit požadavky s laboratoří, získat nabídky, provést předběžné zkoušky a počítat s opravami v rozpočtu. Certifikované součástky neznamenají certifikaci celého zařízení.'},
  {title:'Vodotěsná krabička',text:'Vyvinout a otestovat krabičku, těsnění, konektory a uchycení. Stupeň ochrany proti vodě zveřejnit až po ověření.'},
  {title:'Testování v praxi',text:'Otestovat výrobní návrh na vodě: čitelnost na slunci, výdrž baterie, výkon GPS, obnovu spojení, působení vody a každodenní manipulaci.'},
  {title:'Certifikace hardwaru',text:'Dokončit příslušné zkoušky a posouzení shody hotového zařízení včetně technické dokumentace, označení a návodů.',note:'Překážka prodeje hardwaru. Než ji překonáme, potřebujeme finální návrh, rozsah zkoušek, nabídky laboratoří a financování.'},
  {title:'Malosériová výroba',text:'Vyrobit pilotní sérii, zkontrolovat každý kus a ověřit opakovatelnost montáže. Před navýšením výroby připravit zásobování, balení, dohledatelnost a postup oprav.'},
  {title:'Prodej',text:'Nabídnout hotové jednotky Veetr Vane, až budou připravené certifikace, výroba a zákaznická podpora. Tehdy zveřejnit skutečnou cenu, dostupnost a očekávané dodání.'},
];
export const milestones = original.map((milestone,index) => {
  const {alt,caption,...copy} = translations[index];
  return {...milestone,...copy,image:milestone.image ? {...milestone.image,alt:alt!,caption:caption!} : undefined};
});
