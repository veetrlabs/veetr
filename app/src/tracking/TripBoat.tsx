import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import TripBoatPicker from './TripBoatPicker';
import { selectTripBoat, type TripBoat as Boat } from './tripSharing';
import type { TrackingSession } from './model';
import { trackingStore } from './database';
import { t, translateMessage } from '../i18n';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../constants/colors';

export default function TripBoat({ session, onSaved }: {
  session: TrackingSession;
  onSaved: (session: TrackingSession) => void;
}) {
  const c = themeColors[useTheme().theme];
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saving = useRef(false);
  const editable = session.mode === 'local' && !session.sharing;
  async function select(boat: Boat) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      await selectTripBoat(session.id, boat);
      const updated = await (await trackingStore()).localRecording(session.id);
      if (updated) onSaved(updated.session);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { saving.current = false; setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    {editable ? <TripBoatPicker selected={session.boatId} selectedName={session.boatName} enabled={!busy} onSelect={boat => void select(boat)} /> : <>
      <Text style={{ color: c.text, fontWeight: '600' }}>{t('Boat for this trip')}</Text>
      <Text style={{ color: c.text }}>{session.boatName || t('Unknown')}</Text>
      <Text style={{ color: c.textMuted }}>{t(session.sharing ? 'The boat is fixed once a trip has been uploaded.' : 'Boat selection is available for personal trips.')}</Text>
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{translateMessage(error)}</Text>}
  </View>;
}
