import { View, StyleSheet } from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'
import Dashboard from '../../components/Dashboard'
import GPSStatusButton from '../../components/GPSStatusButton'

export default function DashboardTab() {
  const { theme } = useTheme()
  const colors = themeColors[theme]

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Dashboard />
      <View style={styles.floatingLayer} pointerEvents="box-none">
        <GPSStatusButton />
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
})
