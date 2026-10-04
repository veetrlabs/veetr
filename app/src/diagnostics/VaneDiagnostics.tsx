import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useBLE } from '../context/BLEContext';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../constants/colors';
import { t } from '../i18n';
import { APP_VERSION } from '../utils/version';
import { ensureDiagnosticIdentity } from './service';
import { requestVaneDiagnostic, vaneFindings, largestHeadingStep, type VaneReport } from './vane';
const key = 'veetr-vane-diagnostic-report-v1';
export default function VaneDiagnostics() {
  const {state, sendCommand} = useBLE();
  const c = themeColors[useTheme().theme];
  const [report, setReport] = useState<VaneReport | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const mounted = useRef(true);
  const started = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; let alive = true; void AsyncStorage.getItem(key).then(raw => { if (alive && !started.current && raw) { const saved = JSON.parse(raw); if (saved.id && Array.isArray(saved.samples)) setReport(saved); } }).catch(() => {}); return () => { alive = false; mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { if (!state.isConnected || state.firmwareInfo.isUpdating) controller.current?.abort(); }, [state.isConnected, state.firmwareInfo.isUpdating]);
  async function run() {
    if (controller.current || !state.isConnected || state.firmwareInfo.isUpdating) return;
    started.current = true;
    const abort = new AbortController(); controller.current = abort;
    setProgress(0); setMessage('');
    const next: VaneReport = {id: Crypto.randomUUID(), occurredAt: new Date().toISOString(), firmware: state.firmwareInfo.currentVersion, appVersion: APP_VERSION, samples: []};
    try {
      for (let i = 0; i < 15; i++) {
        next.samples.push(await requestVaneDiagnostic(sendCommand, abort.signal));
        if (mounted.current) setProgress(i + 1);
        if (i < 14) await new Promise<void>(resolve => { const done = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', done); resolve(); }; const timer = setTimeout(done, 2000); abort.signal.addEventListener('abort', done, {once:true}); });
      }
      await AsyncStorage.setItem(key, JSON.stringify(next)); if (mounted.current) setReport(next);
    } catch (error) {
      if (mounted.current && !abort.signal.aborted) setMessage(error instanceof Error ? error.message : 'Diagnostics failed.');
      if (next.samples.length) { await AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {}); if (mounted.current) setReport(next); }
    } finally { controller.current = null; if (mounted.current) setProgress(null); }
  }
  async function exportReport() {
    if (!report) return;
    let file: File | undefined;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
      file = new File(Paths.cache, `veetr-vane-${report.id}.json`); file.write(JSON.stringify(report, null, 2));
      await Sharing.shareAsync(file.uri, {mimeType:'application/json', UTI:'public.json'});
    } catch (e) { setMessage(String(e)); } finally { if (file?.exists) file.delete(); }
  }
  async function send() {
    if (!report) return;
    setSending(true); setMessage('');
    const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 10000);
    try {
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL, apiKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !apiKey) throw new Error('Diagnostics unavailable in this build.');
      const response = await fetch(`${url}/rest/v1/rpc/submit_vane_diagnostic`, {method:'POST', headers:{'Content-Type':'application/json',apikey:apiKey,Authorization:`Bearer ${apiKey}`}, body:JSON.stringify({report:{...report, installationId:await ensureDiagnosticIdentity()}}), signal:abort.signal});
      if (!response.ok || await response.json() !== report.id) throw new Error('Report could not be sent. It remains saved on this phone; try again later.');
      setMessage('Report sent to Veetr.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Report could not be sent.'); }
    finally { clearTimeout(timer); setSending(false); }
  }
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:14, borderRadius:10, backgroundColor:c.buttonBg, opacity:disabled ? .5 : 1}}><Text style={{color:c.text}}>{t(label)}</Text></Pressable>;
  return <View style={{padding:16, borderRadius:14, gap:12, backgroundColor:c.panelBg}}>
    <Text style={{color:c.text, fontWeight:'700'}}>{t('Vane diagnostics')}</Text>
    <Text style={{color:c.textSecondary}}>{t('Observe the connected Vane for 30–60 seconds. Keep this screen open. Calibration and settings will not change.')}</Text>
    {progress === null ? button('Run Vane diagnostics', () => void run(), !state.isConnected || state.firmwareInfo.isUpdating || sending) : <>
      <Text style={{color:c.text}}>{progress}/15</Text>{button('Cancel', () => controller.current?.abort())}
    </>}
    {report && <>
      <Text style={{color:c.textMuted}}>{t('Saved report')} · {new Date(report.occurredAt).toLocaleString()} · {report.samples.length}/15</Text>
      {largestHeadingStep(report.samples) !== null && <Text style={{color:c.text}}>{t('Largest sampled heading change')}: {largestHeadingStep(report.samples)!.toFixed(1)}°</Text>}
      <Text style={{color:c.textMuted}}>{t('Boat movement also changes heading. This check cannot prove that the sensor is faulty.')}</Text>
      {vaneFindings(report.samples).map(finding => <Text key={finding} style={{color:c.text}}>{t(finding)}</Text>)}
      <Text selectable style={{color:c.textMuted}}>ID: {report.id}</Text>
      <Text style={{color:c.textSecondary}}>{t('Sending shares technical sensor readings and app/firmware versions with Veetr support. No GPS coordinates are included.')}</Text>
      {button('Export report', () => void exportReport(), progress !== null || sending)}
      {button('Send to Veetr', () => void send(), progress !== null || sending)}
    </>}
    {!!message && <Text accessibilityRole="alert" style={{color:c.text}}>{t(message)}</Text>}
  </View>;
}
