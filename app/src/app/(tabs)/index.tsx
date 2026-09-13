import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'
import Dashboard from '../../components/Dashboard'
import ConnectionStatus from '../../components/ConnectionStatus'
import BluetoothButton from '../../components/BluetoothButton'
import SatelliteButton from '../../components/SatelliteButton'

export default function DashboardTab() {
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Dashboard />
      <View style={styles.floatingLayer} pointerEvents="box-none">
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <ConnectionStatus />
        </View>
        <BluetoothButton />
        <SatelliteButton />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  topBar: {
    position: 'absolute',
    left: 60,
    right: 10,
  },
})
