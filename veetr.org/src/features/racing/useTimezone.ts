import {useEffect,useSyncExternalStore} from 'react';
import {initializeAccountTimezone} from './accountTimezone';
import {currentTimezone,timezonePreference} from './timezone';
const subscribe=(notify:()=>void)=>{window.addEventListener('veetr-timezone',notify);window.addEventListener('storage',notify);return ()=>{window.removeEventListener('veetr-timezone',notify);window.removeEventListener('storage',notify);};};
export function useTimezone() {
  useEffect(initializeAccountTimezone,[]);
  return useSyncExternalStore(subscribe,()=>timezonePreference()+'|'+currentTimezone(),()=> 'UTC');
}
