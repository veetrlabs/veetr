import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapView, Marker, Circle } from '../components/NativeMap';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../constants/colors';
import { t, translateMessage, useLanguageRefresh } from '../i18n';
import { useNavigation } from '../navigation/NavigationContext';
import { useFollowCamera } from '../maps/useFollowCamera';
import { Coordinate, distanceM, radiusM, usableFix } from './model';
import { armAnchor, editAnchor, getAnchorSnapshot, loadAnchor, stopAnchor, subscribeAnchor } from './service';
import { notifyAlarm, openAlarmSettings, prepareNotifications, stopAlarmTest } from './notifications';
// Allow clearing/retyping and either decimal separator, but reject invalid edits
// (including pasted text) instead of turning them into a different number.
const DECIMAL_INPUT = /^\d*(?:[.,]\d*)?$/;

export default function AnchorSettings({ onBack }: { onBack: () => void }) {
  useLanguageRefresh();
  const { theme } = useTheme(), c = themeColors[theme], insets = useSafeAreaInsets();
  const { enableGPS, error: gpsError } = useNavigation();
  const { settings: s, fix, error, ready } = useSyncExternalStore(subscribeAnchor, getAnchorSnapshot);
  const [chain, setChain] = useState(String(s.chainM)), [margin, setMargin] = useState(String(s.marginM));
  const [busy, setBusy] = useState(false), [localError, setLocalError] = useState('');
  const map = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false), [follow, setFollow] = useState(true);
  const testBusy = useRef(false);
  const [testWaiting, setTestWaiting] = useState(false);
  const [testPending, setTestPending] = useState(false), [testMessage, setTestMessage] = useState('');
  const [testError, setTestError] = useState('');
  const [mapMoving, setMapMoving] = useState(false);
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState<Coordinate | null>(null);
  useEffect(() => {
    if (!testWaiting) return;
    const timer = setTimeout(() => { setTestWaiting(false); setTestMessage('The test alarm is due now. If it is silent, check alarm permissions and volume.'); }, 5000);
    return () => clearTimeout(timer);
  }, [testWaiting]);
  useEffect(() => { void loadAnchor().catch(e => setLocalError(String(e))); }, []);
  useEffect(() => { setChain(String(s.chainM)); setMargin(String(s.marginM)); }, [s.chainM, s.marginM]);
  const live = usableFix(fix, Date.now()) ? fix : null;
  const center = editing ? draft : live ?? s.anchor;
  useFollowCamera(map, mapReady, follow && !editing, 0, live);
  const chainM = chain.trim() ? Number(chain.replace(',', '.')) : NaN;
  const marginM = margin.trim() ? Number(margin.replace(',', '.')) : NaN;
  const dirty = chainM !== s.chainM || marginM !== s.marginM;
  const startRequirements = [
    ...(!ready ? ['Waiting for saved anchor settings to load.'] : []),
    ...(!s.anchor ? ['Save an anchor position using Anchor dropped or Edit anchor on map.'] : []),
    ...(!live ? ['Waiting for a current boat GPS position. Phone accuracy must be 50 m or better. Placing the anchor on the map does not set the boat position.'] : []),
    ...(dirty ? ['Save the chain length and margin before starting.'] : []),
    ...(editing ? ['Save or cancel the map edit before starting.'] : []),
    ...(Platform.OS === 'web' ? ['Anchor monitoring requires the mobile app.'] : []),
  ];
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setLocalError('');
    try { await action(); } catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function testSound(stop = false) {
    if (testBusy.current || (!stop && testWaiting)) return;
    testBusy.current = true;
    setTestPending(true); setTestError('');
    setTestMessage(stop ? 'Stopping test alarm…' : 'Preparing test alarm…');
    try {
      if (stop) {
        await stopAlarmTest();
        setTestWaiting(false);
        setTestMessage('Test alarm stopped.');
      } else {
        await prepareNotifications();
        await notifyAlarm(true, s.sound);
        setTestWaiting(true);
        setTestMessage('Test alarm scheduled. It starts in five seconds. Lock your phone now.');
      }
    } catch (e) {
      setTestMessage('');
      setTestError(e instanceof Error ? e.message : String(e));
    } finally { testBusy.current = false; setTestPending(false); }
  }
  function confirmChange(action: () => Promise<unknown>) {
    if (!s.armed) { void run(action); return; }
    Alert.alert(t('Change active anchor alarm?'), t('This changes the monitored area and resets the current alarm.'), [
      { text: t('Cancel'), style: 'cancel' }, { text: t('Save'), onPress: () => void run(action) },
    ]);
  }
  function start() {
    Alert.alert(t('Start anchor alarm'), t('Veetr uses location in the background, including with the screen locked, to monitor your anchor. Positions stay on this phone for this feature. Keep the phone aboard; it is the fallback when Vane GPS is unavailable. Allow precise location and background access on the next screens. Test the alarm with your phone locked before use. Force-quitting the app can stop monitoring and, on Android, cancel scheduled alarms.'), [
      { text: t('Cancel'), style: 'cancel' }, { text: t('Start'), onPress: () => void run(armAnchor) },
    ]);
  }
  const button = (label: string, action: () => void, disabled = false, danger = false) => (
    <TouchableOpacity accessible accessibilityRole="button" accessibilityLabel={t(label)} accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy} onPress={action}
      style={[styles.button, { backgroundColor: danger ? '#b91c1c' : '#006b62', opacity: disabled || busy ? 0.45 : 1 }]}>
      <Text style={styles.buttonText}>{t(label)}</Text>
    </TouchableOpacity>
  );
  return <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    <TouchableOpacity accessibilityRole="button" onPress={onBack}><Text style={styles.back}>{t('‹ Settings')}</Text></TouchableOpacity>
    <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{t('Anchor alarm')}</Text>
    <View style={[styles.status, { backgroundColor: c.cardBg }]}>
      <Text accessibilityRole={s.alarm ? 'alert' : undefined} style={[styles.statusText, { color: s.alarm ? '#ef4444' : c.text }]}>
        {t(s.alarm ? 'Anchor alarm triggered' : s.armed ? error ? 'Anchor monitoring needs attention' : live ? 'Monitoring anchor' : 'Waiting for reliable GPS' : 'Anchor alarm off')}
      </Text>
      <Text style={{ color: c.textSecondary }}>{live ? t(live.source === 'vane' ? 'Using Vane GPS' : 'Using phone GPS') : t('No reliable position')}</Text>
      {s.anchor && live && <Text style={{ color: c.text }}>{t('Distance from anchor: {{distance}} m', { distance: Math.round(distanceM(s.anchor, live)) })}</Text>}
      <Text style={{ color: c.text }}>{t('Alarm radius: {{radius}} m', { radius: radiusM(s) })}</Text>
    </View>
    {(localError || error) && <Text accessibilityRole="alert" style={{ color: '#ef4444', marginVertical: 8 }}>{translateMessage(localError || error)}</Text>}
    {button('Anchor dropped', () => {
      if (live) confirmChange(() => editAnchor({ anchor: { latitude: live.latitude, longitude: live.longitude } }));
    }, !ready || !live || editing)}
    {!live && button('Enable phone GPS', () => void run(enableGPS))}
    {!live && gpsError && <Text accessibilityRole="alert" style={{ color: '#ef4444' }}>{translateMessage(gpsError)}</Text>}
    <Text style={[styles.help, { color: c.textSecondary }]}>{t('Anchor dropped saves your current position. If you missed the moment, edit the anchor on the map.')}</Text>
    <View style={styles.map}>
      {MapView ? <MapView ref={map} onMapReady={() => setMapReady(true)} onPanDrag={() => setFollow(false)} key={editing ? 'edit' : center ? 'position' : 'world'} style={{ flex: 1 }} userInterfaceStyle={theme}
        initialRegion={{ latitude: center?.latitude ?? 0, longitude: center?.longitude ?? 0,
          latitudeDelta: center ? Math.max(0.003, radiusM(s) / 25000) : 140, longitudeDelta: center ? Math.max(0.003, radiusM(s) / 18000) : 140 }}
        onRegionChange={region => {
          if (editing) {
            setMapMoving(true);
            setDraft({ latitude: region.latitude, longitude: region.longitude });
          }
        }}
        onRegionChangeComplete={region => {
          if (editing) {
            setDraft({ latitude: region.latitude, longitude: region.longitude });
            setMapMoving(false);
          }
        }}>
        {!editing && s.anchor && <Marker coordinate={s.anchor} title={t('Anchor')} />}
        {(editing ? draft : s.anchor) && <Circle center={(editing ? draft : s.anchor)!} radius={radiusM(s)} strokeColor="#008c80" fillColor="rgba(0,140,128,0.15)" />}
        {live && <Marker coordinate={live} title={t('Boat')} pinColor="#3182ce" />}
      </MapView> : <Text style={{ color: c.text }}>{t('Anchor monitoring requires the mobile app.')}</Text>}
      {editing && <View pointerEvents="none" style={styles.targetOverlay}>
        <View accessible accessibilityLabel={t('Anchor target')} style={styles.target}>
          <View style={styles.targetRing} />
          <View style={styles.targetHorizontal} />
          <View style={styles.targetVertical} />
        </View>
      </View>}
    </View>
    {(editing ? draft : s.anchor) && <Text style={[styles.help, { color: c.textSecondary }]}>{(editing ? draft : s.anchor)!.latitude.toFixed(6)}, {(editing ? draft : s.anchor)!.longitude.toFixed(6)}</Text>}
    {!editing && button(follow ? 'Following boat position' : 'Show my position', () => setFollow(true), !live)}
    {editing ? <>
      <Text style={[styles.help, { color: c.text }]}>{t('Move the map until the anchor position is under the center target, then save.')}</Text>
      {button('Save anchor position', () => {
        if (draft && !mapMoving) confirmChange(async () => { await editAnchor({ anchor: draft }); setMapReady(false); setFollow(true); setEditing(false); });
      }, !draft || mapMoving)}
      {button('Cancel', () => { setMapReady(false); setFollow(true); setEditing(false); })}
    </> : button('Edit anchor on map', () => { setDraft(s.anchor ?? live); setMapMoving(false); setMapReady(false); setEditing(true); }, !ready || Platform.OS === 'web')}
    <Text style={[styles.label, { color: c.text }]}>{t('Chain out (m)')}</Text>
    <TextInput accessibilityLabel={t('Chain out (m)')} value={chain} onChangeText={value => { if (DECIMAL_INPUT.test(value)) setChain(value); }} autoCorrect={false} editable={!busy && ready} keyboardType="decimal-pad"
      style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.inputBg }]} />
    <Text style={[styles.label, { color: c.text }]}>{t('Extra margin (m)')}</Text>
    <TextInput accessibilityLabel={t('Extra margin (m)')} value={margin} onChangeText={value => { if (DECIMAL_INPUT.test(value)) setMargin(value); }} autoCorrect={false} editable={!busy && ready} keyboardType="decimal-pad"
      style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.inputBg }]} />
    <Text style={[styles.help, { color: c.textSecondary }]}>{t('Alarm radius = chain out + extra margin. Allow for boat length, GPS error and where the phone or Vane is mounted. These values are saved until you change them.')}</Text>
    {button('Save chain and margin', () => confirmChange(() => editAnchor({ chainM, marginM })), !dirty || !ready)}
    {s.armed ? button('Stop anchor alarm', () => void run(stopAnchor), false, true) : button('Start anchor alarm', start, startRequirements.length > 0)}
    {!s.armed && startRequirements.map(reason => <Text key={reason} style={[styles.help, { color: c.textSecondary }]}>{t(reason)}</Text>)}
    <Text style={[styles.label, { color: c.text }]}>{t('Alarm sound')}</Text>
    {button(s.sound === 'system' ? 'System alarm sound ✓' : 'System alarm sound', () => confirmChange(() => editAnchor({ sound: 'system' })), !ready)}
    {button(s.sound === 'siren' ? 'Siren ✓' : 'Siren', () => confirmChange(() => editAnchor({ sound: 'siren' })), !ready)}
    {button('Alarm permissions and volume', () => void run(openAlarmSettings), Platform.OS === 'web')}
    {button('Test alarm sound', () => void testSound(), Platform.OS === 'web' || testPending || testWaiting)}
    {button('Stop test sound', () => void testSound(true), Platform.OS === 'web' || testPending)}
    {testMessage && <Text accessibilityLiveRegion="polite" style={[styles.help, { color: c.text }]}>{t(testMessage)}</Text>}
    {testError && <Text accessibilityRole="alert" style={[styles.help, { color: '#ef4444' }]}>{translateMessage(testError)}</Text>}
    <Text style={[styles.help, { color: c.textSecondary }]}>{t(Platform.OS === 'ios' ? 'Requires iOS 26 or newer and Alarms permission. AlarmKit sounds through Silent mode and Focus. Adjust Ringtone and Alerts volume in iPhone Settings → Sounds & Haptics.' : 'Uses Android alarm volume. Allow Alarms & reminders and notifications. Turn up Alarm volume and allow alarms through Do Not Disturb in system settings.')}</Text>
    <Text style={[styles.help, { color: c.textSecondary }]}>{t('Keep the phone aboard and charged. Vane GPS is preferred while fresh; phone GPS takes over when needed. A native alarm sounds when the boat leaves the radius or reliable GPS updates stop for 90 seconds. After a drag alarm, stop and restart to rearm. The test starts in five seconds: lock the phone and check that it wakes you. Force-quitting can stop position monitoring.')}</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  back: { color: '#3182ce', paddingVertical: 10, fontSize: 16 }, title: { fontSize: 24, fontWeight: '700', marginVertical: 12 },
  status: { padding: 16, borderRadius: 12, gap: 6 }, statusText: { fontSize: 18, fontWeight: '700' },
  button: { padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 6 }, buttonText: { color: '#fff', fontWeight: '600' },
  map: { height: 300, borderRadius: 12, overflow: 'hidden', marginVertical: 8 },
  targetOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  targetRing: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.3)' },
  targetHorizontal: { position: 'absolute', width: 48, height: 4, borderWidth: 1, borderColor: '#fff', backgroundColor: '#003f3a' },
  targetVertical: { position: 'absolute', width: 4, height: 48, borderWidth: 1, borderColor: '#fff', backgroundColor: '#003f3a' },
  help: { fontSize: 14, lineHeight: 21, marginVertical: 8 }, label: { marginTop: 12, marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, padding: 12, borderRadius: 8, fontSize: 18 },
});
