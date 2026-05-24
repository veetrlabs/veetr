import { View, Text, StyleSheet } from 'react-native'
import Svg, { Line, Circle, Path } from 'react-native-svg'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <View style={styles.container}>
      <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <Line x1="1" y1="1" x2="23" y2="23" />
        <Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <Path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <Path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <Path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <Line x1="12" y1="20" x2="12.01" y2="20" />
      </Svg>
      <Text style={styles.text}>Offline Mode</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#e53e3e',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
})
