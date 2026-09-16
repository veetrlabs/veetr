import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateSeries,standingsForView, type Series} from '../../src/features/racing/domain';
const dir = new URL('./', import.meta.url);
const read = (name:string) => JSON.parse(readFileSync(new URL(name,dir),'utf8'));
const source = read('season-source.json');
const heats = read('heat-sources.json');
const aliases = read('aliases.json');
const uuid = (name:string) => {const h=createHash('sha256').update('orlik-real-2026:'+name).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const categories = ['≤ 7 m','> 7 m','Race'].map(name=>({id:uuid(name),name}));
const s:Series={id:uuid('series'),name:'Orlická série 2026',year:2026,status:'active',description:'Vánoční a Radavská regata zrušeny. O pohár Vltavy: čekáme na výsledky. Pohár Slunce: připravuje se. Izolepa: pouze jachtařské rozjížďky. 24hodinovka se počítá dvakrát. Škrtání jednoho výsledku od 4 závodů je zatím pracovní nastavení pro porovnání.',categories,boats:[],events:[],races:[],discards:[{from:4,discard:1}],pointsStart:0};
source.forEach((sheet:any,i:number)=>sheet.boats.forEach((b:any)=>s.boats.push({id:uuid(b.name),name:b.name,categoryId:categories[i].id,sailNumber:'',className:''})));
const boatFor=(name:string)=>{const canonical=aliases[name]??name;const boat=s.boats.find(b=>b.name.toLowerCase()===canonical.toLowerCase());if(!boat)throw Error(name);return boat;};
source[0].events.forEach((name:string,index:number)=>{
 const event={id:uuid(name),name,order:index+1,weight:1,countAs:index===2?2:1,completed:[0,2,4,5,6].includes(index),entries:s.boats.map(b=>b.id),discards:[]};s.events!.push({...event,...([1,3].includes(index)?{scheduleStatus:'Cancelled' as const}:index===7?{scheduleStatus:'Awaiting results' as const}:index===8?{scheduleStatus:'Upcoming' as const}:{})});
 if(!event.completed)return;
 if(heats[name]) {
  const doc=heats[name];const columns=name==='Izolepa'?[1,2]:[0,1];event.entries=doc.rows.map((r:any)=>boatFor(r.name).id);s.events![s.events!.length-1].entries=event.entries;
  columns.forEach((col:number,i:number)=>s.races.push({id:uuid(name+':heat:'+col),eventId:event.id,name:`Rozjížďka ${i+1}`,date:'',order:s.races.length+1,weight:1,status:'published',entries:event.entries,results:doc.rows.map((r:any)=>({boatId:boatFor(r.name).id,status:typeof r.overall?.[col]==='string'?r.overall[col]:'SCORED',points:r.points[col]}))}));
 } else {
  s.races.push({id:uuid(name+':aggregate'),eventId:event.id,kind:'aggregate',name:'Souhrnné výsledky (bez rozpisu rozjížděk)',date:'',order:s.races.length+1,weight:1,status:'published',entries:event.entries,results:source.flatMap((sheet:any)=>sheet.boats.map((b:any)=>({boatId:boatFor(b.name).id,status:'SCORED' as const,points:b.scores[index]+(index===2?1:0)})))});
 }
});
validateSeries(s);
writeFileSync(new URL('series.json',dir),JSON.stringify(s,null,2)+'\n');
const lines=['# Orlická série 2026 — porovnání importu','','Zdroj: Pořadí Orlická série 2026.xlsx, FxC Cancer regata výsledky.pdf a fotografie Izolepy.','','24h: pořadí = buňka + 2; do seriálu dvě samostatná bodování pořadí − 1. Izolepa: sloupce 2 a 3; první (běh) vynechán. Cancer: původní bodové penalizace zachovány. Souhrnné výsledky nejsou vydávány za jednotlivé rozjížďky. Neznámá data zůstávají prázdná. Zrušené a neodehrané závody nebodují.','','Pracovní škrtání: jeden výsledek od čtyř dokončených závodů (nutno potvrdit). Čísla nelze očekávat totožná po opravě 24h a vynechání běhu.','','| Loď | Excel součet | Import součet | Excel po škrtnutí | Import po škrtnutí |','|---|---:|---:|---:|---:|'];
let matches=0;
source.forEach((sheet:any,i:number)=>{const rows=standingsForView(s,categories[i].id);sheet.boats.forEach((b:any)=>{const row=rows.find(r=>r.id===boatFor(b.name).id)!;if(row.countedTotal===b.counted)matches++;lines.push(`| ${b.name} | ${b.raw} | ${row.rawTotal} | ${b.counted} | ${row.countedTotal} |`);});});
lines.push('',`Shoda přepočtených bodů: ${matches}/${s.boats.length} lodí.`);
writeFileSync(new URL('reconciliation.md',dir),lines.join('\n')+'\n');
console.log(JSON.stringify({id:s.id,boats:s.boats.length,events:s.events!.length,heatOrAggregateRecords:s.races.length,matches}));
