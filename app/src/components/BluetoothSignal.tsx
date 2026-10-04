import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBLE } from '../context/BLEContext'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'
import { t, useLanguageRefresh } from '../i18n'

export default function BluetoothSignal() {
  useLanguageRefresh()
  const { state } = useBLE(), { theme } = useTheme(), insets = useSafeAreaInsets()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!state.isConnected) return
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [state.isConnected])
  const c = themeColors[theme]
  const rssi = state.isConnected && state.rssiUpdatedAt != null && now - state.rssiUpdatedAt < 65000 ? state.rssi : null
  const bars = rssi == null ? 0 : rssi >= -50 ? 4 : rssi >= -70 ? 3 : rssi >= -85 ? 2 : 1
  const color = !bars ? c.textMuted : bars >= 3 ? '#22c55e' : bars === 2 ? '#f97316' : '#ef4444'
  const status = state.isConnecting ? t('Connecting...') : !state.isConnected ? t('Disconnected') : rssi == null ? t('Signal unavailable') : `${rssi} dBm`
  return <View accessible accessibilityLabel={`${t('Bluetooth signal')}: ${status}`} style={{ position: 'absolute', top: insets.top + 4, right: Math.max(8, insets.right), alignItems: 'center', padding: 6, borderRadius: 12, backgroundColor: c.bg }}>
    <Svg width={42} height={28} viewBox="0 0 42 28">
      <Path d="M5 7l14 14-9 6V1l9 6L5 21" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {[7, 12, 17, 22].map((h, i) => <Rect key={h} x={23 + i * 5} y={26 - h} width={3} height={h} rx={1} fill={bars > i ? color : c.border} />)}
    </Svg>
    <Text style={{ color: c.textSecondary, fontSize: 10, marginTop: 2 }}>{status}</Text>
  </View>
}
