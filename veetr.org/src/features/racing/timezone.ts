const key = 'veetr.timezone';
export function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try { new Intl.DateTimeFormat('en', {timeZone:value}); return true; } catch { return false; }
}
export function browserTimezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
let memoryPreference='auto';
export function timezonePreference() {
  try { const value=localStorage.getItem(key); return validTimezone(value) ? value : 'auto'; } catch { return memoryPreference; }
}
export function currentTimezone() { const value=timezonePreference(); return value==='auto' ? browserTimezone() : value; }
export function setTimezonePreference(value: string) {
  if(value!=='auto' && !validTimezone(value)) throw new Error('Invalid timezone');
  memoryPreference=value;
  try { localStorage.setItem(key,value); } catch { /* Browsers may disable storage. */ }
  if(typeof window!=='undefined') window.dispatchEvent(new Event('veetr-timezone'));
}
export function timezoneOptions() {
  const intl=Intl as typeof Intl & {supportedValuesOf?: (key:string)=>string[]};
  return [...new Set(['UTC',browserTimezone(),currentTimezone(),...(intl.supportedValuesOf?.('timeZone') ?? [])])].filter(validTimezone).sort();
}
export function formatDateTime(value: string | number | Date, kind: 'date'|'time'|'full'='full', locale?: string, options: Intl.DateTimeFormatOptions={}) {
  const date=new Date(value);
  const opts={...options,timeZone:currentTimezone()};
  const language=locale || (typeof document==='undefined' ? undefined : document.documentElement.lang || undefined);
  return kind==='date' ? date.toLocaleDateString(language,opts) : kind==='time' ? date.toLocaleTimeString(language,opts) : date.toLocaleString(language,opts);
}
export function localDateTime(value: string | null | undefined, zone=currentTimezone()) {
  if(!value) return '';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const get=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
// Resolve wall-clock input with the offsets on both sides of a possible DST change.
// Reject missing/repeated times instead of silently choosing the wrong instant.
export function utcDateTime(value: string, zone=currentTimezone()) {
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(value)) throw new Error('Choose a valid date and time');
  const normalized=value.length===16 ? value+':00' : value;
  const naive=Date.parse(normalized+'Z');
  if(!Number.isFinite(naive) || new Date(naive).toISOString().slice(0,19)!==normalized) throw new Error('Choose a valid date and time');
  const candidates=new Set<number>();
  for(let hour=-36;hour<=36;hour+=6) {
    const probe=naive+hour*3600000;
    const offset=Date.parse(localDateTime(new Date(probe).toISOString(),zone)+'Z')-probe;
    const candidate=naive-offset;
    if(localDateTime(new Date(candidate).toISOString(),zone)===normalized) candidates.add(candidate);
  }
  if(candidates.size===0) throw new Error('This time does not exist because the clocks change. Choose another time.');
  if(candidates.size>1) throw new Error('This time occurs twice because the clocks change. Select UTC in Preferences to enter the exact time.');
  return new Date([...candidates][0]).toISOString();
}
