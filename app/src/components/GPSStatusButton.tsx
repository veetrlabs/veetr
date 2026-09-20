import { useState } from 'react'
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '../navigation/NavigationContext'
import { useBLE } from '../context/BLEContext'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'
import NavigationStatus from '../navigation/NavigationStatus'

export default function GPSStatusButton() {
  const nav = useNavigation(), { state } = useBLE(), { theme } = useTheme(), insets = useSafeAreaInsets()
  const c = themeColors[theme], [open, setOpen] = useState(false)
  const fix = nav.fix
  const accuracy = fix?.accuracy
  const hdop = fix?.source === 'Veetr GPS' ? state.sailingData.hdop : null
  // Signal indicator represents fix quality, not radio signal strength.
  const quality = !fix ? 0 : accuracy != null ? (accuracy <= 10 ? 3 : accuracy <= 30 ? 2 : 1) : hdop != null && hdop > 0 ? (hdop <= 1 ? 3 : hdop <= 2 ? 2 : 1) : 1
  const color = quality === 0 ? '#ef4444' : quality === 3 ? '#22c55e' : '#f59e0b'
  const label = quality === 0 ? 'No GPS signal' : quality === 3 ? 'Good GPS fix' : 'Limited GPS accuracy'
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`GPS status: ${label}. Show details`} onPress={() => setOpen(true)} style={[styles.icon, { top: insets.top + 4, left: Math.max(8, insets.left), backgroundColor: c.bg }]}>
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Circle cx="8" cy="9" r="4" stroke={color} strokeWidth={2} />
        <Path d="M8 2v3m0 8v3M1 9h3m8 0h3" stroke={color} strokeWidth={2} />
        {[8, 13, 18].map((h, i) => <Rect key={h} x={9 + i * 6} y={26 - h} width={4} height={h} rx={1} fill={quality === 0 || quality > i ? color : c.border} />)}
      </Svg>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss GPS details" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: c.panelBg }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>GPS status</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close GPS details" onPress={() => setOpen(false)} style={styles.close}><Text style={{ color: c.text, fontSize: 24 }}>×</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            <Text style={{ color, fontWeight: '600' }}>{label}</Text>
            {fix && <>
              <Text selectable style={{ color: c.textSecondary }}>{fix.latitude.toFixed(5)}°, {fix.longitude.toFixed(5)}°</Text>
              {accuracy != null && <Text style={{ color: c.textSecondary }}>Reported accuracy: ±{Math.round(accuracy)} m</Text>}
              {fix.source === 'Veetr GPS' && <Text style={{ color: c.textSecondary }}>{state.sailingData.gpsSatellites} satellites · HDOP {hdop != null && hdop > 0 ? hdop.toFixed(1) : 'unavailable'}</Text>}
            </>}
            <NavigationStatus showMode={false} />
            {!!nav.phoneHeading.status && <Text style={{ color: c.textSecondary }}>{nav.phoneHeading.status}</Text>}
            {nav.phoneHeading.rawSample && <Text selectable style={{ color: c.textSecondary }}>
              Compass magnetic: raw {nav.phoneHeading.rawSample.magHeading.toFixed(1)}° · filtered {nav.phoneHeading.heading?.toFixed(1) ?? '—'}°
              {'\n'}Compass true: {nav.phoneHeading.sample?.trueHeading != null && nav.phoneHeading.sample.trueHeading >= 0 ? `${nav.phoneHeading.sample.trueHeading.toFixed(1)}°` : 'unavailable'} · sensor quality {nav.phoneHeading.rawSample.accuracy}/3
            </Text>}
            {nav.session?.phase === 'recording' && <Text selectable style={{ color: c.textSecondary }}>
              Last background GPS: {nav.session.lastBackgroundFixAt ? new Date(nav.session.lastBackgroundFixAt).toLocaleTimeString() : 'not received yet'}
              {nav.session.lastTaskError ? `\nBackground error: ${nav.session.lastTaskError}` : ''}
            </Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>
}
const styles = StyleSheet.create({
  icon: { position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  panel: { width: '100%', maxWidth: 420, maxHeight: '100%', borderRadius: 20, padding: 20, flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
