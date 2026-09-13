import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBLE } from '../context/BLEContext'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'

export default function SatelliteButton() {
  const { state } = useBLE()
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const insets = useSafeAreaInsets()
  const { sailingData } = state
  const [showModal, setShowModal] = useState(false)

  if (!state.isConnected) return null

  const hdop = sailingData.hdop || 99
  const hdopColor = hdop <= 1.0 ? '#22c55e' : hdop <= 2.0 ? '#f97316' : '#ef4444'

  const formatLatLon = (value: number, isLatitude: boolean) => {
    if (!value || value === 0) return '0.000°'
    return `${Math.abs(value).toFixed(3)}°${isLatitude ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')}`
  }

  return (
    <>
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.buttonBg, top: insets.top + 8 }]} onPress={() => setShowModal(true)}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={hdopColor} strokeWidth="2">
          <Path d="M4 7V4h16v3" />
          <Path d="M9 20h6" />
          <Path d="M12 4v16" />
        </Svg>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <View style={[styles.modal, { backgroundColor: colors.panelBg }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>GPS Information</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.body}>
              <InfoRow label="Satellites" value={`${sailingData.gpsSatellites || 0}`} theme={theme} />
              <InfoRow label="HDOP" value={(sailingData.hdop || 0).toFixed(1)} theme={theme} />
              <InfoRow label="Latitude" value={formatLatLon(sailingData.lat || 0, true)} theme={theme} />
              <InfoRow label="Longitude" value={formatLatLon(sailingData.lon || 0, false)} theme={theme} />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

function InfoRow({ label, value, theme }: { label: string; value: string; theme: 'light' | 'dark' }) {
  const colors = themeColors[theme]
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700' },
  close: { fontSize: 20, padding: 4 },
  body: { gap: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '600' },
})
