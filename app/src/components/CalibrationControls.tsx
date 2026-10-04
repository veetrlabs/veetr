import SensorCalibration from './SensorCalibration';
import { useEffect, useState } from 'react';
import { useBLE } from '../context/BLEContext';
import { t, useLanguageRefresh } from '../i18n';
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'

export default function CalibrationControls({ connected, onLevel, onNorth }: { connected: boolean; onLevel: () => void; onNorth: () => void }) {
  useLanguageRefresh();
  const { state } = useBLE();
  const [sensorCalibrationActive, setSensorCalibrationActive] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const compass = state.sailingData.compass;
  const fresh = connected && compass && now - compass.receivedAt < 5000;
  const ready = fresh && compass.quality >= 2 && state.sailingData.recordingInstruments?.heading != null;
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const actions = [
    { title: t("Vessel level"), description: t("With Veetr mounted in its sailing position, keep the boat level and still, then tap Set level to zero the tilt readings."), label: t("Set level"), onPress: onLevel },
    { title: t("Compass reference"), description: t("Point the boat’s bow toward a known north reference and hold it steady, then tap Set north to align Veetr’s heading."), label: t("Set north"), onPress: onNorth },
  ]
  return <View style={styles.content}>
    <SensorCalibration onActive={setSensorCalibrationActive} />
    {connected && <Text style={[styles.description, { color: colors.textSecondary }]}>{t(!compass ? "Compass quality unavailable. Update Vane firmware to 0.0.29 or later." : !fresh ? "Waiting for fresh compass readings." : ready ? "Compass ready for north alignment." : "Compass is settling or accuracy is low. Wait before setting north.")}</Text>}
    {actions.map(action => <View key={action.label} style={[styles.card, { backgroundColor: colors.panelBg, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{action.title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{action.description}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: sensorCalibrationActive || !connected || (action.onPress === onNorth && !!compass && !ready) }} disabled={sensorCalibrationActive || !connected || (action.onPress === onNorth && !!compass && !ready)} onPress={action.onPress} style={({ pressed }) => [styles.button, { backgroundColor: connected ? '#006b62' : colors.chartBg, opacity: pressed ? 0.8 : 1 }]}>
        <Text style={[styles.buttonText, { color: connected ? '#fff' : colors.textMuted }]}>{action.label}</Text>
      </Pressable>
    </View>)}
    {!connected && <Text style={[styles.description, { color: colors.textMuted }]}>{t("Connect Veetr in Bluetooth settings to calibrate.")}</Text>}
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
