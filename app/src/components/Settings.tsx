import { requestNorthAlignment, northResultMessage } from '../utils/northAlignment';
import { translateMessage, t, useLanguageRefresh } from '../i18n';
import PreferencesSettings from "./PreferencesSettings";
import CalibrationControls from './CalibrationControls'
import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, Animated, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'
import { useBLE } from '../context/BLEContext'
import { hasValidGPSFix } from '../utils/gpsValidation'
import { FirmwareUpdateCard } from './cards/FirmwareUpdateCard'
import { APP_VERSION } from '../utils/version'

const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.85, 360)

type ViewType = 'preferences' | 'main' | 'bluetooth' | 'calibration' | 'regatta'

export default function Settings() {
  useLanguageRefresh();
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
    if (!state.isConnected) { Alert.alert(t("Not Connected"), t("Please connect to Veetr Vane first")); return }
    Alert.alert(t("Calibrate Level"), t("This will set the current orientation as level (0°) across all axes."), [
      { text: t("Cancel"), style: 'cancel' },
      { text: t("Calibrate"), onPress: async () => {
        const success = await sendCommand({ action: 'resetHeelAngle' })
        Alert.alert(success ? t("Success") : t("Failed"), success ? t("Vessel level calibration completed!") : t("Failed to calibrate."))
      }}
    ])
  }

  const handleCalibrateCompass = () => {
    if (!state.isConnected) { Alert.alert(t("Not Connected"), t("Please connect to Veetr Vane first")); return }
    Alert.alert(t("Calibrate Compass"), t("Point the vessel's bow toward north."), [
      { text: t("Cancel"), style: 'cancel' },
      { text: t("Calibrate"), onPress: async () => {
          const result = await requestNorthAlignment(sendCommand);
          Alert.alert(t(result === 'accepted' ? 'Success' : 'Compass reference'), t(northResultMessage[result]));
      }}
    ])
  }

  const handleSetDeviceName = () => {
    if (!state.isConnected) { Alert.alert(t("Not Connected"), t("Please connect first")); return }
    if (!deviceName.trim()) { Alert.alert(t("Invalid"), t("Please enter a device name")); return }
    Alert.alert(t("Set Device Name"), t("Change device name to \"{{v0}}\"? Device will restart.", { v0: deviceName.trim() }), [
      { text: t("Cancel"), style: 'cancel' },
      { text: t("Set"), onPress: async () => {
        const success = await sendCommand({ action: 'setDeviceName', deviceName: deviceName.trim() })
        Alert.alert(success ? t("Success") : t("Failed"), success ? t("Device name set. Device is restarting.") : t("Failed to set name."))
      }}
    ])
  }

  const handleRegattaSet = async (side: 'port' | 'starboard') => {
    if (!state.isConnected) { Alert.alert(t("Not Connected"), t("Please connect first")); return }
    const hasGPS = hasValidGPSFix(state.sailingData.gpsSatellites, state.sailingData.lat, state.sailingData.lon)
    if (!hasGPS) { Alert.alert(t("No GPS"), t("GPS fix required. Need at least 3 satellites.")); return }
    const success = await sendCommand({ action: side === 'port' ? 'regattaSetPort' : 'regattaSetStarboard' })
    if (!success) Alert.alert(t("Failed"), t("Failed to set {{v0}} position.", { v0: t(side) }))
  }

  const handleRegattaClear = async (side: 'port' | 'starboard') => {
    if (!state.isConnected) { Alert.alert(t("Not Connected"), t("Please connect first")); return }
    const success = await sendCommand({ action: side === 'port' ? 'regattaClearPort' : 'regattaClearStarboard' })
    if (!success) Alert.alert(t("Failed"), t("Failed to clear {{v0}} position.", { v0: t(side) }))
  }

  const renderMainMenu = () => (
    <>
      <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.menuTitle, { color: colors.text }]}>{t("Veetr Menu")}</Text>
        <TouchableOpacity onPress={closeMenu}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('bluetooth')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>Bluetooth</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('regatta')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>{t("Race Start Line")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('calibration')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>{t("Calibration")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>


      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Preferences")} style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigateTo('preferences')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>{t("Preferences")}</Text>
        <Text style={[styles.arrow, { color: colors.textSubtle }]}>›</Text>
      </TouchableOpacity>
      <Text style={[styles.version, { color: colors.textSubtle }]}>{t("App Version:")} {APP_VERSION}</Text>
    </>
  )

  const renderBluetooth = () => (
    <>
      <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>{t("‹ Back")}</Text></TouchableOpacity>
        <Text style={[styles.menuTitle, { color: colors.text }]}>Bluetooth</Text>
        <TouchableOpacity onPress={closeMenu}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
      </View>

      <View style={styles.statusBox}>
        <View style={[styles.statusDot, state.isConnected ? styles.connected : styles.disconnected]} />
        <Text style={[styles.statusText, { color: colors.text }]}>
          {state.isConnecting ? t("Connecting...") : state.isConnected ? t("Connected") : t("Disconnected")}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.bigButton, state.isConnected ? styles.disconnectBtn : styles.connectBtn]}
        onPress={() => state.isConnected ? disconnect() : connect()}
        disabled={state.isConnecting}
      >
        <Text style={styles.bigButtonText}>
          {state.isConnecting ? t("Connecting...") : state.isConnected ? t("Disconnect") : t("Connect to Veetr")}
        </Text>
      </TouchableOpacity>

      {state.error && (
        <Text selectable accessibilityRole="alert" style={{ color: colors.text, marginTop: 12 }}>
          {t("Bluetooth error:")} {translateMessage(state.error)}
        </Text>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t("Device Name")}</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder="Veetr_Port_Side"
          placeholderTextColor={colors.textSubtle}
          maxLength={20}
        />
        <TouchableOpacity accessibilityRole="button" disabled={!state.isConnected || state.isConnecting} accessibilityState={{ disabled: !state.isConnected || state.isConnecting }} style={[styles.smallButton, { backgroundColor: state.isConnected && !state.isConnecting ? '#006b62' : colors.chartBg }]} onPress={handleSetDeviceName}>
          <Text style={[styles.smallButtonText, (!state.isConnected || state.isConnecting) && { color: colors.textMuted }]}>{t("Set Name")}</Text>
        </TouchableOpacity>
      </View>
      <FirmwareUpdateCard />
    </>
  )

  const renderCalibration = () => (
    <>
      <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>{t("‹ Back")}</Text></TouchableOpacity>
        <Text style={[styles.menuTitle, { color: colors.text }]}>{t("Calibration")}</Text>
        <TouchableOpacity onPress={closeMenu}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
      </View>

      <CalibrationControls connected={state.isConnected && !state.isConnecting} onLevel={handleCalibrateLevel} onNorth={handleCalibrateCompass} />
    </>
  )

  const renderRegatta = () => (
    <>
      <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigateTo('main')}><Text style={styles.back}>{t("‹ Back")}</Text></TouchableOpacity>
        <Text style={[styles.menuTitle, { color: colors.text }]}>{t("Race Start Line")}</Text>
        <TouchableOpacity onPress={closeMenu}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => handleRegattaSet('port')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>{t("Set Port Line")}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => handleRegattaClear('port')}>
        <Text style={[styles.menuItemText, { color: '#e53e3e' }]}>{t("Clear Port Line")}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => handleRegattaSet('starboard')}>
        <Text style={[styles.menuItemText, { color: colors.text }]}>{t("Set Starboard Line")}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => handleRegattaClear('starboard')}>
        <Text style={[styles.menuItemText, { color: '#e53e3e' }]}>{t("Clear Starboard Line")}</Text>
      </TouchableOpacity>
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
            <ScrollView key={currentView}>
              {currentView === 'preferences' && (
                <>
                  <TouchableOpacity accessibilityRole="button" onPress={() => navigateTo('main')}>
                    <Text style={[styles.back, { paddingVertical: 12 }]}>{t("‹ Settings")}</Text>
                  </TouchableOpacity>
                  <Text accessibilityRole="header" style={[styles.menuTitle, { color: colors.text, marginBottom: 16 }]}>{t("Preferences")}</Text>
                  <PreferencesSettings />
                </>
              )}
              {currentView === 'main' && renderMainMenu()}
              {currentView === 'bluetooth' && renderBluetooth()}
              {currentView === 'calibration' && renderCalibration()}
              {currentView === 'regatta' && renderRegatta()}
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
