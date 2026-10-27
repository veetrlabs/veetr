import {supabase} from './api';
import {setTimezonePreference, validTimezone} from './timezone';
let initialized=false;
export function initializeAccountTimezone() {
  if(initialized || !supabase) return;
  initialized=true;
  const apply=(user: {user_metadata: Record<string,unknown>} | null)=>{
    if(user) {const value=user.user_metadata.preferred_timezone;setTimezonePreference(validTimezone(value) ? value : 'auto');}
  };
  void supabase.auth.getSession().then(({data})=>apply(data.session?.user ?? null));
  supabase.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT') setTimezonePreference('auto');
    else apply(session?.user ?? null);
  });
}
async function writeTimezonePreference(value: string) {
  if(value!=='auto' && !validTimezone(value)) throw new Error('Invalid timezone');
  if(supabase) {
    const {data,error}=await supabase.auth.getUser();
    // No session is expected for anonymous visitors.
    if(error && error.name!=='AuthSessionMissingError') throw error;
    if(data.user) {
      const result=await supabase.auth.updateUser({data:{preferred_timezone:value}});
      if(result.error) throw result.error;
    }
  }
  setTimezonePreference(value);
}

let pending: Promise<void> = Promise.resolve();
export function saveTimezonePreference(value: string) {
  pending=pending.catch(()=>{}).then(()=>writeTimezonePreference(value));
  return pending;
}
