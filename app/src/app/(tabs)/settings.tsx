import CalibrationControls from '../../components/CalibrationControls'
import QuickGuide from '../../components/QuickGuide'
import RegattaSettings from '../../components/RegattaSettings'
import BluetoothSettings from '../../components/BluetoothSettings'
import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'
import { useBLE } from '../../context/BLEContext'
import { FirmwareUpdateCard } from '../../components/cards/FirmwareUpdateCard'
import DataManager from '../../components/DataManager'
import ThemeToggle from '../../components/ThemeToggle'
import { APP_VERSION } from '../../utils/version'

type ViewType = 'guide' | 'bluetooth' | 'main' | 'regatta' | 'calibration' | 'about'

export default function SettingsTab() {
  const insets = useSafeAreaInsets()
  const [currentView, setCurrentView] = useState<ViewType>('main')
  const { state, sendCommand } = useBLE()
  const { theme } = useTheme()
  const colors = themeColors[theme]

  const navigateTo = (view: ViewType) => setCurrentView(view)

  const handleCalibrateLevel = () => {
    if (!state.isConnected) { Alert.alert('Not Connected', 'Please connect to Veetr device first'); return }
    Alert.alert('Calibrate Level', 'This will set the current orientation as level (0°) across all axes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Calibrate', onPress: async () => {
        const success = await sendCommand({ action: 'resetHeelAngle' })
        Alert.alert(success ? 'Success' : 'Failed', success ? 'Vessel level calibration completed!' : 'Failed to calibrate.')
      }}
    ])
  }

  const handleCalibrateCompass = () => {
    if (!state.isConnected) { Alert.alert('Not Connected', 'Please connect to Veetr device first'); return }
    Alert.alert('Calibrate Compass', "Point the vessel's bow toward north.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Calibrate', onPress: async () => {
        const success = await sendCommand({ action: 'resetCompassNorth' })
        Alert.alert(success ? 'Success' : 'Failed', success ? 'Compass calibrated!' : 'Failed to calibrate.')
      }}
    ])
  }

  const renderMain = () => (
    <>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Settings</Text>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Bluetooth settings" style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('bluetooth')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Bluetooth settings</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Regatta" style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('regatta')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Regatta</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('calibration')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Calibration</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('about')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>About</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quick guide" style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('guide')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Quick guide</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>

      <View style={styles.themeRow}>
        <Text style={[styles.themeLabel, { color: colors.text }]}>Theme</Text>
        <ThemeToggle />
      </View>
    </>
  )

  const renderCalibration = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Calibration</Text>
        <View style={{ width: 50 }} />
      </View>

      <CalibrationControls connected={state.isConnected && !state.isConnecting} onLevel={handleCalibrateLevel} onNorth={handleCalibrateCompass} />
    </>
  )

  const renderAbout = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.text }]}>About</Text>
        <View style={{ width: 50 }} />
      </View>

      <FirmwareUpdateCard />
      <DataManager />
      <Text style={[styles.version, { color: colors.textSubtle }]}>App Version: {APP_VERSION}</Text>
    </>
  )

  if (currentView === 'guide') return <QuickGuide onBack={() => navigateTo('main')} />

  if (currentView === 'regatta') return <RegattaSettings onBack={() => navigateTo('main')} onBluetooth={() => navigateTo('bluetooth')} />

  if (currentView === 'bluetooth') return <BluetoothSettings onBack={() => navigateTo('main')} />

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {currentView === 'main' && renderMain()}
        {currentView === 'calibration' && renderCalibration()}
        {currentView === 'about' && renderAbout()}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 32 },
  pageTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  back: { fontSize: 16, color: '#3182ce', fontWeight: '600', paddingVertical: 8 },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuItemText: { fontSize: 16 },
  arrow: { fontSize: 22 },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  themeLabel: { fontSize: 16 },
  version: { fontSize: 14, textAlign: 'center', marginTop: 16 },
})
