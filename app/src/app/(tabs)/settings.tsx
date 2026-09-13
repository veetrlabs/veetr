import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'
import { useBLE } from '../../context/BLEContext'
import { hasValidGPSFix } from '../../utils/gpsValidation'
import { FirmwareUpdateCard } from '../../components/cards/FirmwareUpdateCard'
import DataManager from '../../components/DataManager'
import ThemeToggle from '../../components/ThemeToggle'
import { APP_VERSION } from '../../utils/version'

type ViewType = 'main' | 'regatta' | 'calibration' | 'about'

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

  const handleRegattaSet = async (side: 'port' | 'starboard') => {
    if (!state.isConnected) { Alert.alert('Not Connected', 'Please connect first'); return }
    const hasGPS = hasValidGPSFix(state.sailingData.gpsSatellites, state.sailingData.lat, state.sailingData.lon)
    if (!hasGPS) { Alert.alert('No GPS', 'GPS fix required. Need at least 3 satellites.'); return }
    const success = await sendCommand({ action: side === 'port' ? 'regattaSetPort' : 'regattaSetStarboard' })
    if (!success) Alert.alert('Failed', `Failed to set ${side} position.`)
  }

  const handleRegattaClear = async (side: 'port' | 'starboard') => {
    if (!state.isConnected) { Alert.alert('Not Connected', 'Please connect first'); return }
    const success = await sendCommand({ action: side === 'port' ? 'regattaClearPort' : 'regattaClearStarboard' })
    if (!success) Alert.alert('Failed', `Failed to clear ${side} position.`)
  }

  const renderMain = () => (
    <>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Settings</Text>

      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('regatta')}>
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

      <View style={styles.themeRow}>
        <Text style={[styles.themeLabel, { color: colors.text }]}>Theme</Text>
        <ThemeToggle />
      </View>
    </>
  )

  const renderRegatta = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Regatta</Text>
        <View style={{ width: 50 }} />
      </View>

      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => handleRegattaSet('port')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Set Port Line</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => handleRegattaClear('port')}>
        <Text style={[styles.menuItemText, { color: '#e53e3e' }]}>Clear Port Line</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => handleRegattaSet('starboard')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Set Starboard Line</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => handleRegattaClear('starboard')}>
        <Text style={[styles.menuItemText, { color: '#e53e3e' }]}>Clear Starboard Line</Text>
      </TouchableOpacity>
    </>
  )

  const renderCalibration = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Calibration</Text>
        <View style={{ width: 50 }} />
      </View>

      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleCalibrateLevel}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Set vessel is Level</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleCalibrateCompass}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Set vessel pointing North</Text>
      </TouchableOpacity>
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

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {currentView === 'main' && renderMain()}
        {currentView === 'regatta' && renderRegatta()}
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
