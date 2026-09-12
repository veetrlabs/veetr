import React, {useState} from 'react';
import {eventsFor,eventStandings,type Series} from './domain';
import {BoatName} from './BoatName';
import {appHref} from './routes';
import {t} from './i18n';
export function PublicRace({series,eventId}:{series:Series;eventId:string}) {
 const [category,setCategory]=useState('');
 const event=eventsFor(series).find(e=>e.id===eventId);
 const heats=series.races.filter(r=>(r.eventId??r.id)===eventId);
 const back=appHref(`?public=${series.id}`);
 if(!event || !heats.length)return <section><a href={back}>{series.name}</a><h1>{t('Race unavailable')}</h1><p>{t('No published heats are available for this race.')}</p></section>;
 const rows=eventStandings(series,event,category).filter(row=>heats.some(h=>h.entries.includes(row.id)));
 return <>
  <nav className="breadcrumbs" aria-label={t('Breadcrumbs')}><a href={back}>{series.name}</a><span>›</span><span>{event.name}</span></nav>
  <section className="entity-details"><h1>{event.name}</h1><p>{t(event.completed?'Completed':'In progress')} · {t('Weight')}: ×{event.weight}{(event.countAs??1)>1?` · ×${event.countAs} ${t('Races')}`:''}</p>
   {heats.some(h=>h.kind==='aggregate')&&<p>{t('Only the final race result was supplied; individual heat results are unavailable.')}</p>}
  </section>
  <div className="categories"><button className={!category?'active':''} onClick={()=>setCategory('')}>{t('All boats')}</button>{series.categories.map(c=><button key={c.id} className={category===c.id?'active':''} onClick={()=>setCategory(c.id)}>{c.name}</button>)}</div>
  <section><h2>{t('Race standings')}</h2><p>{t('Heat scores after discards. Live results are provisional.')}</p>
   <div className="table-scroll"><table><thead><tr><th>{t('Rank')}</th><th>{t('Boat')}</th>{heats.map(h=><th key={h.id}>{h.name}</th>)}<th>{t('Raw total')}</th><th>{t('Counted total')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.rank||'—'}</td><th><BoatName boat={series.boats.find(b=>b.id===row.id)!}/></th>{heats.map(h=><td key={h.id} className={row.discardedRaceIds.includes(h.id)?'discarded':undefined}>{row.scores.find(s=>s.raceId===h.id)?.points??'—'}</td>)}<td>{row.rawTotal}</td><td className="counted">{row.countedTotal}</td></tr>)}</tbody></table></div>
  </section>
 </>;
}
