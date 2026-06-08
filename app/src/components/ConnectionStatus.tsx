import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useBLE } from '../context/BLEContext'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'

export default function ConnectionStatus() {
  const { state, connect, disconnect } = useBLE()
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    const tick = () => setCurrentTime(Date.now())
    tick()
    const interval = setInterval(tick, 5000)
    return () => clearInterval(interval)
  }, [])

  const getStatusText = () => {
    if (state.isConnecting) return 'Connecting...'
    if (state.isConnected) return 'Connected'
    if (state.error) return `Error: ${state.error}`
    return 'Disconnected'
  }

  const getTimeSinceLastMessage = () => {
    if (!state.lastMessageTime) return 'Never'
    const diff = Math.max(0, Math.floor((currentTime - state.lastMessageTime) / 1000))
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.panelBg }]}>
      <View style={styles.info}>
        <View style={[styles.dot, state.isConnected ? styles.connected : state.isConnecting ? styles.connecting : styles.disconnected]} />
        <Text style={[styles.statusText, { color: colors.text }]}>{getStatusText()}</Text>
        {state.isConnected && (
          <Text style={[styles.updated, { color: colors.textMuted }]}>Updated: {getTimeSinceLastMessage()}</Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.button, state.isConnected ? styles.disconnectBtn : styles.connectBtn]}
        onPress={() => state.isConnected ? disconnect() : connect()}
        disabled={state.isConnecting}
      >
        <Text style={styles.buttonText}>{state.isConnected ? 'Disconnect' : 'Connect'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  connected: { backgroundColor: '#22c55e' },
  connecting: { backgroundColor: '#f97316' },
  disconnected: { backgroundColor: '#ef4444' },
  statusText: { fontSize: 14, fontWeight: '600' },
  updated: { fontSize: 12 },
  button: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  connectBtn: { backgroundColor: '#ef4444' },
  disconnectBtn: { backgroundColor: '#4a5568' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
