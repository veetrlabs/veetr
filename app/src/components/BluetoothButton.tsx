import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBLE } from '../context/BLEContext'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'

export default function BluetoothButton() {
  const { state } = useBLE()
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const insets = useSafeAreaInsets()
  const [showModal, setShowModal] = useState(false)

  if (!state.isConnected) return null

  return (
    <>
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.buttonBg, top: insets.top + 8 }]} onPress={() => setShowModal(true)}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
          <Path d="M6 7l12 10-6 5V2l6 5-12 10" />
        </Svg>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <View style={[styles.modal, { backgroundColor: colors.panelBg }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Bluetooth Signal</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.body}>
              <InfoRow label="Status" value="Connected" valueColor="#22c55e" theme={theme} />
              <InfoRow label="Device" value={state.deviceName || 'Unknown'} theme={theme} />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

function InfoRow({ label, value, valueColor, theme }: { label: string; value: string; valueColor?: string; theme: 'light' | 'dark' }) {
  const colors = themeColors[theme]
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor || colors.text }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 50,
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
