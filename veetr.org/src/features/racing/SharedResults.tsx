import React, {useState} from 'react';
import {calculateSeriesStandings, defaultPolicy} from '@veetr/scoring';
import {type Series, type ControlRace} from './domain';
import {BoatName} from './BoatName';
import {t} from './i18n';

export function HeatResults({series, race}: {series: Series; race: ControlRace}) {
 const [category, setCategory] = useState('');
 const rows = calculateSeriesStandings(series.boats, [race], {...defaultPolicy, discardCount: 0})
   .filter(row => race.entries.includes(row.id) && (!category || row.categoryId === category));
 return <section>
  <h2>{t('Heat results')}</h2>
  <p>{race.date} · {t(race.status === 'draft' ? 'Private' : 'Live')}</p>
  <label>{t('Category')}<select value={category} onChange={e => setCategory(e.target.value)}><option value="">{t('All boats')}</option>{series.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  <div className="table-scroll"><table><thead><tr><th>{t('Boat')}</th><th>{t('Category')}</th><th>{t('Status')}</th><th>{t('Place')}</th><th>{t('Points')}</th></tr></thead><tbody>
   {rows.map(row => {const result = race.results.find(r => r.boatId === row.id); return <tr key={row.id}><th><BoatName boat={series.boats.find(b => b.id === row.id)!}/></th><td>{series.categories.find(c => c.id === row.categoryId)?.name}</td><td>{result ? t(result.status) : '—'}</td><td>{result?.position ?? '—'}</td><td>{row.scores[0]?.points ?? '—'}</td></tr>;})}
  </tbody></table></div>
  {!rows.length && <p>{t('No results yet.')}</p>}
 </section>;
}
