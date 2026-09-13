import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBLE } from '../../context/BLEContext'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'

export default function ConnectTab() {
  const { state, connect, disconnect, sendCommand } = useBLE()
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top + 8 }]}>
      <Text style={[styles.title, { color: colors.text }]}>Connect</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: colors.panelBg }]}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, state.isConnected ? styles.connected : state.isConnecting ? styles.connecting : styles.disconnected]} />
            <Text style={[styles.statusText, { color: colors.text }]}>
              {state.isConnecting ? 'Connecting...' : state.isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.bigBtn, state.isConnected ? styles.disconnectBtn : styles.connectBtn]}
            onPress={() => state.isConnected ? disconnect() : connect()}
            disabled={state.isConnecting}
          >
            <Text style={styles.bigBtnText}>
              {state.isConnecting ? 'Connecting...' : state.isConnected ? 'Disconnect' : 'Connect to Veetr'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.panelBg }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Device Configuration</Text>

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Device Name</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            placeholder="Veetr_Port_Side"
            placeholderTextColor={colors.textSubtle}
            maxLength={20}
          />
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.text }]}
            onPress={() => sendCommand({ action: 'setDeviceName', deviceName: 'Veetr' })}
          >
            <Text style={styles.actionBtnText}>Set Name</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  card: { borderRadius: 12, padding: 16, marginBottom: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  connected: { backgroundColor: '#22c55e' },
  connecting: { backgroundColor: '#f97316' },
  disconnected: { backgroundColor: '#ef4444' },
  statusText: { fontSize: 16, fontWeight: '600' },
  bigBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  connectBtn: { backgroundColor: '#ef4444' },
  disconnectBtn: { backgroundColor: '#4a5568' },
  bigBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 8 },
  actionBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '600' },
})
