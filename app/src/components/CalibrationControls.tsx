import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'

export default function CalibrationControls({ connected, onLevel, onNorth }: { connected: boolean; onLevel: () => void; onNorth: () => void }) {
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const actions = [
    { title: 'Vessel level', description: 'With Veetr mounted in its sailing position, keep the boat level and still, then tap Set level to zero the tilt readings.', label: 'Set level', onPress: onLevel },
    { title: 'Compass reference', description: 'Point the boat’s bow toward a known north reference and hold it steady, then tap Set north to align Veetr’s heading.', label: 'Set north', onPress: onNorth },
  ]
  return <View style={styles.content}>
    {actions.map(action => <View key={action.label} style={[styles.card, { backgroundColor: colors.panelBg, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{action.title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{action.description}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !connected }} disabled={!connected} onPress={action.onPress} style={({ pressed }) => [styles.button, { backgroundColor: connected ? '#006b62' : colors.chartBg, opacity: pressed ? 0.8 : 1 }]}>
        <Text style={[styles.buttonText, { color: connected ? '#fff' : colors.textMuted }]}>{action.label}</Text>
      </Pressable>
    </View>)}
    {!connected && <Text style={[styles.description, { color: colors.textMuted }]}>Connect Veetr in Bluetooth settings to calibrate.</Text>}
  </View>
}
const styles = StyleSheet.create({
  content: { gap: 20 },
  card: { padding: 20, gap: 14, borderWidth: 1, borderRadius: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  description: { fontSize: 15, lineHeight: 22 },
  button: { minHeight: 54, borderRadius: 10, padding: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '600' },
})
