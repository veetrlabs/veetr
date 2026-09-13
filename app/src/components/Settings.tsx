import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, Animated, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'
import { useBLE } from '../context/BLEContext'
import { hasValidGPSFix } from '../utils/gpsValidation'
import { FirmwareUpdateCard } from './cards/FirmwareUpdateCard'
import DataManager from './DataManager'
import ThemeToggle from './ThemeToggle'
import { APP_VERSION } from '../utils/version'

const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.85, 360)

type ViewType = 'main' | 'bluetooth' | 'calibration' | 'regatta' | 'about'

export default function Settings() {
  const insets = useSafeAreaInsets()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [currentView, setCurrentView] = useState<ViewType>('main')
  const [deviceName, setDeviceName] = useState('')
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current
  const { state, sendCommand, connect, disconnect } = useBLE()
  const { theme } = useTheme()
  const colors = themeColors[theme]

  useEffect(() => {
    if (menuOpen) {
      setCurrentView('main')
      setIsVisible(true)
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start()
    } else {
      Animated.timing(slideAnim, { toValue: PANEL_WIDTH, duration: 250, useNativeDriver: true }).start(() => {
        setIsVisible(false)
      })
    }
  }, [menuOpen])

  const openMenu = () => setMenuOpen(true)
  const closeMenu = () => setMenuOpen(false)

  const navigateTo = (view: ViewType) => {
    setCurrentView(view)
  }

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

  const handleSetDeviceName = () => {
    if (!state.isConnected) { Alert.alert('Not Connected', 'Please connect first'); return }
    if (!deviceName.trim()) { Alert.alert('Invalid', 'Please enter a device name'); return }
    Alert.alert('Set Device Name', `Change device name to "${deviceName.trim()}"? Device will restart.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Set', onPress: async () => {
        const success = await sendCommand({ action: 'setDeviceName', deviceName: deviceName.trim() })
        Alert.alert(success ? 'Success' : 'Failed', success ? 'Device name set. Device is restarting.' : 'Failed to set name.')
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

  const renderMainMenu = () => (
    <>
      <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.menuTitle, { color: colors.text }]}>Veetr Menu</Text>
        <TouchableOpacity onPress={closeMenu}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('bluetooth')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Bluetooth</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>
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

      <View style={[styles.themeRow]}>
        <Text style={[styles.themeLabel, { color: colors.text }]}>Theme</Text>
        <ThemeToggle />
      </View>
    </>
  )

  const renderBluetooth = () => (
    <>
      <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={[styles.menuTitle, { color: colors.text }]}>Bluetooth</Text>
        <TouchableOpacity onPress={closeMenu}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
      </View>

      <View style={styles.statusBox}>
        <View style={[styles.statusDot, state.isConnected ? styles.connected : styles.disconnected]} />
        <Text style={[styles.statusText, { color: colors.text }]}>
          {state.isConnecting ? 'Connecting...' : state.isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.bigButton, state.isConnected ? styles.disconnectBtn : styles.connectBtn]}
        onPress={() => state.isConnected ? disconnect() : connect()}
        disabled={state.isConnecting}
      >
        <Text style={styles.bigButtonText}>
          {state.isConnecting ? 'Connecting...' : state.isConnected ? 'Disconnect' : 'Connect to Veetr'}
        </Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Device Name</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder="Veetr_Port_Side"
          placeholderTextColor={colors.textSubtle}
          maxLength={20}
        />
        <TouchableOpacity style={[styles.smallButton, { backgroundColor: colors.text }]} onPress={handleSetDeviceName}>
          <Text style={styles.smallButtonText}>Set Name</Text>
        </TouchableOpacity>
      </View>
    </>
  )

  const renderCalibration = () => (
    <>
      <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={[styles.menuTitle, { color: colors.text }]}>Calibration</Text>
        <TouchableOpacity onPress={closeMenu}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleCalibrateLevel}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Set vessel is Level</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleCalibrateCompass}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Set vessel pointing North</Text>
      </TouchableOpacity>
    </>
  )

  const renderRegatta = () => (
    <>
      <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={[styles.menuTitle, { color: colors.text }]}>Regatta</Text>
        <TouchableOpacity onPress={closeMenu}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
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

  const renderAbout = () => (
    <>
      <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={[styles.menuTitle, { color: colors.text }]}>About</Text>
        <TouchableOpacity onPress={closeMenu}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
      </View>

      <FirmwareUpdateCard />
      <DataManager />
      <Text style={[styles.version, { color: colors.textSubtle }]}>App Version: {APP_VERSION}</Text>
    </>
  )

  return (
    <>
      <TouchableOpacity style={[styles.hamburger, { backgroundColor: colors.buttonBg, top: insets.top + 8 }]} onPress={openMenu}>
        <Text style={[styles.hamburgerText, { color: colors.text }]}>☰</Text>
      </TouchableOpacity>

      {isVisible && (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeMenu} />
          <Animated.View style={[styles.panel, { backgroundColor: colors.panelBg, transform: [{ translateX: slideAnim }] }]}>
            <ScrollView>
              {currentView === 'main' && renderMainMenu()}
              {currentView === 'bluetooth' && renderBluetooth()}
              {currentView === 'calibration' && renderCalibration()}
              {currentView === 'regatta' && renderRegatta()}
              {currentView === 'about' && renderAbout()}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  hamburger: {
    position: 'absolute',
    left: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  hamburgerText: { fontSize: 24 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    padding: 20,
    paddingTop: 60,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  menuTitle: { fontSize: 20, fontWeight: '700' },
  close: { fontSize: 22, padding: 4 },
  back: { fontSize: 16, color: '#3182ce', fontWeight: '600' },
  arrow: { fontSize: 22 },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuItemText: { fontSize: 16 },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  themeLabel: { fontSize: 16 },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  connected: { backgroundColor: '#22c55e' },
  disconnected: { backgroundColor: '#ef4444' },
  statusText: { fontSize: 16, fontWeight: '600' },
  bigButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  connectBtn: { backgroundColor: '#ef4444' },
  disconnectBtn: { backgroundColor: '#4a5568' },
  bigButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  smallButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  smallButtonText: { color: '#fff', fontWeight: '600' },
  version: { fontSize: 14, textAlign: 'center', marginTop: 16 },
})
