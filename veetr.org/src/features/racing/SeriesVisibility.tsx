import React, {useEffect, useState} from 'react';
import {seriesVisibility, type Series, type SeriesVisibility} from './domain';
import {t} from './i18n';
import {requestErrorMessage} from './request';

export function SeriesVisibilitySelect({series, save}: {series: Series; save?: (value: SeriesVisibility) => Promise<void>}) {
  const [value, setValue] = useState(seriesVisibility(series));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => setValue(seriesVisibility(series)), [series.visibility, series.status]);
  return <label>
    {t('Visibility')}
    <select name="visibility" value={value} disabled={busy} onChange={async event => {
      const next = event.target.value as SeriesVisibility;
      const previous = value;
      setValue(next); setError('');
      if (!save) return;
      setBusy(true);
      try { await save(next); }
      catch (error) { setValue(previous); setError(requestErrorMessage(error)); }
      finally { setBusy(false); }
    }}>
      <option value="public">{t('Public · listed for everyone')}</option>
      <option value="unlisted">{t('Unlisted · anyone with the link')}</option>
      <option value="draft">{t('Draft · organizers only')}</option>
    </select>
    {busy && <small role="status">{t('Saving…')}</small>}
    {error && <small role="alert">{t(error)}</small>}
  </label>;
}
