import React, {useState} from 'react';
import {t} from './i18n';
import {browserTimezone,timezoneOptions,timezonePreference} from './timezone';
import {saveTimezonePreference} from './accountTimezone';
export function AccountTimezoneSettings() {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <section className="account-language-settings">
    <label>{t('Timezone')}<select value={timezonePreference()} disabled={busy} onChange={async e=>{
      const next=e.target.value;setBusy(true);setError('');
      try {await saveTimezonePreference(next);} catch {setError('Could not save timezone. Please try again.');} finally {setBusy(false);}
    }}>
      <option value="auto">{t('Automatic (browser timezone)')} · {browserTimezone()}</option>
      {timezoneOptions().map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}
    </select></label>
    <p className="help">{t('Times are shown and entered in this timezone. Changes save automatically.')}</p>
    {busy&&<p role="status">{t('Saving…')}</p>}{error&&<p role="alert">{t(error)}</p>}
  </section>;
}
