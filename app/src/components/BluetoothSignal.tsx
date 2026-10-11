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
  const bars = rssi == null ? 0 : rssi >= -70 ? 3 : rssi >= -85 ? 2 : 1
  const color = !bars ? c.textMuted : bars >= 3 ? '#22c55e' : bars === 2 ? '#f97316' : '#ef4444'
  const status = state.isConnecting ? t('Connecting...') : !state.isConnected ? t('Disconnected') : rssi == null ? t('Signal unavailable') : `${rssi} dBm`
  return <View accessible accessibilityLabel={`${t('Bluetooth signal')}: ${status}`} style={{ position: 'absolute', top: insets.top + 4, right: Math.max(8, insets.right), width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.bg }}>
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Path d="M2 5l10 7-5 4V2l5 4-10 7" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {[8, 13, 18].map((h, i) => <Rect key={h} x={9 + i * 6} y={26 - h} width={4} height={h} rx={1} fill={bars > i ? color : c.border} />)}
    </Svg>
    <Text style={{ color: c.textSecondary, fontSize: 10, position: 'absolute', top: 44, right: 0, width: 110, textAlign: 'right' }}>{status}</Text>
  </View>
}
