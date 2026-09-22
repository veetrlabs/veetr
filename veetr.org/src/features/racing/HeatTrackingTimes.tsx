import React, {useEffect, useState} from 'react';
import {supabase} from './api';
import {t} from './i18n';
export function localDateTime(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,19);
}
export function heatTimeValues(start: string, end: string) {
  const a=Date.parse(start), b=end ? Date.parse(end) : null;
  if (!Number.isFinite(a) || a>Date.now() || (b!==null && (!Number.isFinite(b) || b<=a || b>Date.now()))) throw new Error('Choose valid past heat times');
  return {p_start:new Date(a).toISOString(),p_end:b===null ? null : new Date(b).toISOString()};
}
export function HeatTrackingTimes({heatId,onChange}: {heatId:string;onChange?:()=>void}) {
  const [times,setTimes]=useState<{start:string|null;end:string|null}|null>(null);
  const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [start,setStart]=useState(''),[end,setEnd]=useState('');
  async function refresh() {
    const {data,error}=await supabase!.rpc('public_heat_tracking_times',{p_heat:heatId});
    if(error) throw error;
    const result=data as {start:string|null;end:string|null};
    setTimes(result);setStart(localDateTime(result?.start));setEnd(localDateTime(result?.end));
  }
  useEffect(()=>{void refresh().catch(()=>setError('Heat times are unavailable.'));},[heatId]);
  async function act(action:'start'|'end'|'save') {
    setBusy(true);setError('');
    try {
      const result= action==='save'
        ? await supabase!.rpc('set_heat_tracking_times',{p_heat:heatId,...heatTimeValues(start,end)})
        : await supabase!.rpc('mark_heat_tracking',{p_heat:heatId,p_action:action});
      if(result.error) throw result.error;
      await refresh();setEditing(false);onChange?.();
    } catch {setError('Could not save heat times. Check the times and try again.');}
    finally {setBusy(false);}
  }
  return <section className="heat-tracking-times">
    <h3>{t('Heat replay times')}</h3>
    <p>{t('These times select the heat’s replay. They do not change scoring or stop phone tracking.')}</p>
    {times?.start && <p>{t('Start')}: {new Date(times.start).toLocaleString()} · {t('End')}: {times.end?new Date(times.end).toLocaleString():t('In progress')}</p>}
    {!editing && <div className="replay-toolbar">
      {!times?.start && <button disabled={busy||!times} onClick={()=>act('start')}>{t('Start heat')}</button>}
      {times?.start&&!times.end&&<button disabled={busy} onClick={()=>act('end')}>{t('End heat')}</button>}
      <button disabled={busy||!times} onClick={()=>setEditing(true)}>{t('Edit replay times')}</button>
    </div>}
    {editing && <form onSubmit={e=>{e.preventDefault();void act('save');}}>
      <label>{t('Actual start (your local time)')}<input required type="datetime-local" step="1" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>{t('Actual end (your local time)')}<input type="datetime-local" step="1" value={end} onChange={e=>setEnd(e.target.value)}/></label>
      <p>{t('Leave the end empty while the heat is running.')}</p>
      <div className="replay-toolbar"><button disabled={busy}>{t('Save times')}</button><button type="button" disabled={busy} onClick={()=>setEditing(false)}>{t('Cancel')}</button></div>
    </form>}
    {error&&<p role="alert">{t(error)}</p>}
  </section>;
}
