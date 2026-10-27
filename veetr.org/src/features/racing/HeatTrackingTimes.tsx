import {localDateTime,utcDateTime,currentTimezone,formatDateTime} from "./timezone";
import React, {useEffect, useState} from 'react';
import {supabase} from './api';
import {t} from './i18n';
export {localDateTime} from "./timezone";
export function heatTimeValues(start: string, end: string, timezone=currentTimezone(), original?: {start:string|null;end:string|null}) {
  const instant=(value:string, previous?:string|null)=>previous && localDateTime(previous,timezone)===value ? previous : utcDateTime(value,timezone);
  const a=Date.parse(instant(start,original?.start)), b=end ? Date.parse(instant(end,original?.end)) : null;
  if (!Number.isFinite(a) || a>Date.now() || (b!==null && (!Number.isFinite(b) || b<=a || b>Date.now()))) throw new Error('Choose valid past heat times');
  return {p_start:new Date(a).toISOString(),p_end:b===null ? null : new Date(b).toISOString()};
}
export function HeatTrackingTimes({heatId,onChange,editor=false,onSaveState}: {heatId:string;onChange?:()=>void;editor?:boolean;onSaveState?:(blocked:boolean)=>void}) {
  const [inputTimezone]=useState(currentTimezone);
  const [times,setTimes]=useState<{start:string|null;end:string|null}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [start,setStart]=useState(''),[end,setEnd]=useState('');
  async function refresh() {
    const {data,error}=await supabase!.rpc('public_heat_tracking_times',{p_heat:heatId});
    if(error) throw error;
    const result=data as {start:string|null;end:string|null};
    setTimes(result);setStart(localDateTime(result?.start,inputTimezone));setEnd(localDateTime(result?.end,inputTimezone));
  }
  useEffect(()=>{void refresh().catch(()=>setError('Heat times are unavailable.'));},[heatId]);
  async function act(action:'start'|'end'|'save') {
    setBusy(true);setError('');onSaveState?.(true);
    try {
      const result= action==='save'
        ? await supabase!.rpc('set_heat_tracking_times',{p_heat:heatId,...heatTimeValues(start,end,inputTimezone,times ?? undefined)})
        : await supabase!.rpc('mark_heat_tracking',{p_heat:heatId,p_action:action});
      if(result.error) throw result.error;
      await refresh();onChange?.();onSaveState?.(false);
    } catch (error) {setError(error instanceof Error ? error.message : 'Could not save heat times. Check the times and try again.');}
    finally {setBusy(false);}
  }
  return <section className="heat-tracking-times">
    <h3>{t('Time range on the heat map')}</h3>
    <p>{t('The heat map and speed chart show only this time range. The whole-race map keeps the complete recording. These times do not change results or stop phone tracking.')}</p>
    {times?.start && <p>{t('Start')}: {formatDateTime(times.start, "full")} · {t('End')}: {times.end?formatDateTime(times.end, "full"):t('In progress')}</p>}
    {!editor && <div className="replay-toolbar">
      {!times?.start && <button disabled={busy||!times} onClick={()=>act('start')}>{t('Start heat')}</button>}
      {times?.start&&!times.end&&<button disabled={busy} onClick={()=>act('end')}>{t('End heat')}</button>}
    </div>}
    <p>{t('Timezone')}: {currentTimezone()}</p>
    {editor && <fieldset disabled={busy||!times} onBlur={e=>{
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      if (!times) return;
      if (start!==localDateTime(times.start,inputTimezone) || end!==localDateTime(times.end,inputTimezone)) void act('save');
      else { setError(''); onSaveState?.(false); }
    }}>
      <label>{t('Actual start (your local time)')} · {inputTimezone}<input type="datetime-local" step="1" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>{t('Actual end (your local time)')} · {inputTimezone}<input type="datetime-local" step="1" value={end} onChange={e=>setEnd(e.target.value)}/></label>
      <p>{t('Leave the end empty while the heat is running.')}</p>
      <small>{t('Times save automatically when you leave these fields.')}</small>
    </fieldset>}
    {error&&<p role="alert">{t(error)}</p>}
  </section>;
}
