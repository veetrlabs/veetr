import { canCapturePhone, capturePhoneMark } from '../navigation/phoneStartLine'
import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Line, Circle, Path } from 'react-native-svg'
import { useBLE } from '../context/BLEContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '../navigation/NavigationContext'
import { themeColors } from '../constants/colors'

type Side = 'port' | 'starboard'
const valid = (lat: number | null, lon: number | null) => lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0)

export default function RegattaSettings({ onBack, onBluetooth }: { onBack: () => void; onBluetooth: () => void }) {
  const { state, sendCommand } = useBLE()
  const nav = useNavigation()
  const { deviceFresh, phoneStartLine } = nav
  const deviceMode = state.isConnected
  const source = deviceMode ? "Veetr GPS" : "Phone GPS"
  const { theme } = useTheme()
  const c = themeColors[theme], insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [clearSide, setClearSide] = useState<Side | null>(null)
  const d = state.sailingData
  const gpsReady = deviceMode ? deviceFresh && !!d.gpsValid && valid(d.lat, d.lon) : nav.permission && phoneStartLine.loaded && canCapturePhone(nav.phonePoint)
  const portLat = deviceMode ? d.portLat : phoneStartLine.line.port?.latitude ?? null
  const portLon = deviceMode ? d.portLon : phoneStartLine.line.port?.longitude ?? null
  const starboardLat = deviceMode ? d.starboardLat : phoneStartLine.line.starboard?.latitude ?? null
  const starboardLon = deviceMode ? d.starboardLon : phoneStartLine.line.starboard?.longitude ?? null
  const marks = [
    { side: 'port' as const, title: 'Port end', hint: 'Usually the pin', lat: portLat, lon: portLon, color: theme === 'dark' ? '#fb7185' : '#be3455' },
    { side: 'starboard' as const, title: 'Starboard end', hint: 'Usually the committee boat', lat: starboardLat, lon: starboardLon, color: theme === 'dark' ? '#5eead4' : '#087f73' },
  ]
  const saved = marks.map(m => valid(m.lat, m.lon))
  const count = saved.filter(Boolean).length
  useEffect(() => {
    if (state.isConnected) void sendCommand({ action: 'regattaGet' }).catch(() => {})
  }, [state.isConnected, sendCommand])

  async function command(side: Side, clear = false) {
    if (busy || (!clear && !gpsReady)) return
    setBusy(true); setNotice(''); setClearSide(null)
    try {
      if (!deviceMode) {
        await phoneStartLine.saveMark(side, clear ? null : capturePhoneMark(nav.phonePoint))
        setNotice(clear ? 'Position cleared from this phone.' : 'Position saved on this phone.')
        return
      }
      const action = clear ? (side === 'port' ? 'regattaClearPort' : 'regattaClearStarboard') : (side === 'port' ? 'regattaSetPort' : 'regattaSetStarboard')
      if (!await sendCommand({ action })) throw new Error('Could not reach Veetr. Check Bluetooth and try again.')
      await sendCommand({ action: 'regattaGet' })
      setNotice('Request sent. Positions below update when Veetr replies.')
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not update the line. Try again.') }
    finally { setBusy(false) }
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Settings" onPress={onBack} style={styles.back}><Text style={{ color: c.textSecondary }}>‹ Settings</Text></Pressable>
      <Text style={[styles.eyebrow, { color: c.textMuted }]}>REGATTA</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Set your start line</Text>
      <Text style={[styles.body, { color: c.textSecondary }]}>Sail to each end, then capture its position using {source}. You can set either end first.</Text>

      <View style={[styles.status, { backgroundColor: c.panelBg, borderColor: c.border }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.bold, { color: c.text }]}>{gpsReady ? `${source} ready` : `Waiting for ${source}`}</Text>
          <Text style={{ color: c.textSecondary }}>{deviceMode ? (gpsReady ? `${d.gpsSatellites} satellites · ready to capture` : 'A fresh Veetr GPS fix is needed.') : gpsReady ? `Accuracy ±${Math.round(nav.phonePoint!.accuracyM!)} m · saved on this phone` : 'Enable location and wait for accuracy of 30 m or better.'}</Text>
        </View>
        {!deviceMode && !nav.permission && <Pressable accessibilityRole="button" onPress={() => void nav.enableGPS()} style={[styles.smallButton, { backgroundColor: c.buttonBg }]}><Text style={[styles.bold, { color: c.text }]}>Enable GPS</Text></Pressable>}
      </View>

      <View style={[styles.diagram, { backgroundColor: c.panelBg, borderColor: c.border }]}>
        <View style={styles.row}><Text style={[styles.bold, { color: c.text }]}>Start line</Text><Text style={{ color: c.textSecondary }}>{count} of 2 ends set</Text></View>
        <Svg width="100%" height={90} viewBox="0 0 320 90" accessibilityLabel="Start line schematic, not to scale">
          <Line x1="36" y1="57" x2="284" y2="57" stroke={count === 2 ? '#087f73' : c.border} strokeWidth={3} strokeDasharray={count === 2 ? undefined : '6 6'} />
          <Path d="M36 57V18l25 8-25 9" stroke={marks[0].color} fill="none" strokeWidth={3} />
          <Path d="M265 47h38l-8 15h-23z M276 47V29h14v18" stroke={marks[1].color} fill="none" strokeWidth={3} />
          <Circle cx="36" cy="57" r="6" fill={saved[0] ? marks[0].color : c.panelBg} stroke={marks[0].color} strokeWidth={2} />
          <Circle cx="284" cy="57" r="6" fill={saved[1] ? marks[1].color : c.panelBg} stroke={marks[1].color} strokeWidth={2} />
        </Svg>
        <View style={styles.row}><Text style={{ color: marks[0].color }}>Port / pin</Text><Text style={{ color: marks[1].color }}>Starboard / boat</Text></View>
      </View>

      {marks.map((m, i) => <View key={m.side} style={[styles.card, { backgroundColor: c.panelBg, borderColor: c.border }]}>
        <View style={styles.row}><Text accessibilityRole="header" style={[styles.cardTitle, { color: c.text }]}>{m.title}</Text><Text style={{ color: saved[i] ? m.color : c.textMuted }}>{saved[i] ? 'Position saved' : 'Not set'}</Text></View>
        <Text style={{ color: c.textSecondary }}>{m.hint}</Text>
        {saved[i] && <Text selectable style={{ color: c.textMuted, fontVariant: ['tabular-nums'] }}>{m.lat!.toFixed(5)}°, {m.lon!.toFixed(5)}°</Text>}
        <Pressable accessibilityRole="button" disabled={!gpsReady || busy} onPress={() => void command(m.side)} style={[styles.capture, { backgroundColor: gpsReady && !busy ? m.color : c.buttonBg }]}>
          <Text style={[styles.bold, { color: gpsReady && !busy ? '#fff' : c.textMuted }]}>{busy ? 'Updating…' : `${saved[i] ? 'Capture again' : 'Capture'} · ${m.title.toLowerCase()}`}</Text>
        </Pressable>
        {saved[i] && clearSide !== m.side && <Pressable accessibilityRole="button" disabled={busy || (!deviceMode && !phoneStartLine.loaded)} onPress={() => setClearSide(m.side)} style={styles.clear}><Text style={{ color: c.textMuted }}>Clear {m.title.toLowerCase()}</Text></Pressable>}
        {clearSide === m.side && <View style={{ gap: 10 }}>
          <Text style={{ color: c.text }}>Clear this saved position? You will need to capture this end again.</Text>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={() => setClearSide(null)} style={styles.smallButton}><Text style={{ color: c.text }}>Keep position</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy || (!deviceMode && !phoneStartLine.loaded)} onPress={() => void command(m.side, true)} style={styles.smallButton}><Text style={{ color: '#be3455', fontWeight: '600' }}>Clear position</Text></Pressable>
          </View>
        </View>}
      </View>)}
      {!deviceMode && !!(nav.error || phoneStartLine.error) && <Text accessibilityRole="alert" style={{ color: c.textSecondary }}>{nav.error || phoneStartLine.error}</Text>}
      {!!notice && <Text accessibilityRole="alert" style={{ color: c.textSecondary }}>{notice}</Text>}
      <Text style={[styles.body, { color: c.textMuted }]}>{deviceMode ? "Showing the line saved on Veetr." : "Showing the line saved on this phone."} Capture again if a mark moves. The line above is a diagram; the map shows the saved positions.</Text>
    </ScrollView>
  )
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  body: { fontSize: 15, lineHeight: 22 },
  bold: { fontSize: 15, fontWeight: '600' },
  status: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderRadius: 14, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  diagram: { padding: 18, borderWidth: 1, borderRadius: 16 },
  card: { padding: 18, gap: 10, borderWidth: 1, borderRadius: 16 },
  cardTitle: { fontSize: 20, fontWeight: '600' },
  capture: { minHeight: 54, padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  smallButton: { padding: 12, minHeight: 44, borderRadius: 8, justifyContent: 'center' },
  clear: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
})
