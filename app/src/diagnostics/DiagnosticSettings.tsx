import { useEffect, useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../constants/colors';
import { diagnosticIdentity, diagnosticsEnabled, sendDiagnosticReport, setDiagnosticsEnabled } from './service';

export default function DiagnosticSettings() {
  const { theme } = useTheme(), c = themeColors[theme];
  const [enabled, setEnabled] = useState(false), [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [identity, setIdentity] = useState<string | null>(null);
  useEffect(() => { let alive = true; void Promise.all([diagnosticsEnabled(), diagnosticIdentity()]).then(([value, id]) => { if (alive) { setEnabled(value); setIdentity(id); setReady(true); } }).catch(() => { if (alive) setMessage('Could not load diagnostic settings.'); }); return () => { alive = false; }; }, []);
  async function toggle(value: boolean) {
    setBusy(true);
    try { await setDiagnosticsEnabled(value); setEnabled(value); setIdentity(await diagnosticIdentity()); setMessage(value ? 'Automatic reports enabled.' : 'Automatic reports disabled. Queued reports deleted.'); }
    catch { setMessage('Could not save your choice. Please try again.'); }
    finally { setBusy(false); }
  }
  async function send() {
    setBusy(true);
    try { setMessage(await sendDiagnosticReport()); }
    catch { setMessage('Could not prepare the report. Please try again.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>Diagnostic reports</Text>
    <Text style={{ color: c.textSecondary, lineHeight: 22 }}>
      Help improve Veetr by sending technical information about errors and tracking reliability to Veetr through Supabase. Reports include app and phone versions, permission status, GPS accuracy, time since the last fix or upload, and error categories. They exclude GPS coordinates, routes, names and emails. Reports are deleted from our diagnostic database after 30 days.
    </Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: c.text, flex: 1 }}>Share diagnostic reports</Text>
      <Switch accessibilityLabel="Share diagnostic reports" value={enabled} disabled={!ready || busy} onValueChange={value => void toggle(value)} />
    </View>
    <Text style={{ color: c.textSecondary }}>Optional and off by default. You can turn this off anytime without affecting tracking. This stops automatic reports and deletes unsent reports; it does not recall reports already received.</Text>
    {enabled && identity && <Text selectable style={{ color: c.textSecondary }}>Diagnostic ID: {identity}</Text>}
    <Text style={{ color: c.textSecondary }}>Send one report below to share the technical information listed above now, without enabling automatic reports. If offline, it will be queued for up to 7 days.</Text>
    <Pressable accessibilityRole="button" disabled={!ready || busy} onPress={() => void send()} style={{ padding: 16, backgroundColor: c.buttonBg, borderRadius: 12, opacity: busy ? 0.5 : 1 }}>
      <Text style={{ color: c.text, fontWeight: '600' }}>Send diagnostic report</Text>
    </Pressable>
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://veetr.org/legal/privacy/').catch(() => setMessage('Could not open the privacy policy.'))} style={{ paddingVertical: 8 }}>
      <Text style={{ color: c.text }}>Privacy policy</Text>
    </Pressable>
    {!!message && <Text selectable accessibilityLiveRegion="polite" style={{ color: c.text }}>{message}</Text>}
  </View>;
}
