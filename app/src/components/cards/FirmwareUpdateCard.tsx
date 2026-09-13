import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useBLE } from '../../context/BLEContext'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'
import { formatTime } from '../../utils/firmwareUpdater'

export function FirmwareUpdateCard() {
  const { state, checkForUpdates, startFirmwareUpdate } = useBLE()
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const handleCheckForUpdates = async () => {
    setIsChecking(true)
    try {
      await checkForUpdates()
      setLastChecked(new Date())
    } catch (error) {
      console.error('Failed to check for updates:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleStartUpdate = () => {
    Alert.alert(
      'Update Firmware',
      'Are you sure you want to update the firmware? The device will restart during this process.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          style: 'destructive',
          onPress: async () => {
            try {
              await startFirmwareUpdate()
              Alert.alert(
                'Update Completed',
                'The device has restarted with the new firmware. Please wait 10-15 seconds and reconnect.'
              )
            } catch (error) {
              Alert.alert('Update Failed', error instanceof Error ? error.message : 'Unknown error')
            }
          }
        }
      ]
    )
  }

  useEffect(() => {
    if (state.isConnected && !lastChecked) {
      handleCheckForUpdates()
    }
  }, [state.isConnected])

  if (!state.isConnected) {
    return (
      <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
        <View style={[styles.badge, { backgroundColor: colors.border }]}>
          <Text style={[styles.badgeText, { color: colors.textSecondary }]}>Device Disconnected</Text>
        </View>
        <Text style={[styles.text, { color: colors.textSecondary }]}>Connect to your sailing device to check for firmware updates.</Text>
      </View>
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
      <View style={styles.info}>
        <View style={styles.versionItem}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Device Firmware:</Text>
          <Text style={[styles.versionNumber, { color: colors.text }]}>{state.firmwareInfo.currentVersion}</Text>
        </View>
        {state.firmwareInfo.latestVersion && (
          <View style={styles.versionItem}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Available Firmware:</Text>
            <Text style={[styles.versionNumber, { color: colors.text }]}>{state.firmwareInfo.latestVersion}</Text>
          </View>
        )}
      </View>

      {state.firmwareInfo.latestVersion && !state.firmwareInfo.updateAvailable && (
        <Text style={styles.upToDate}>Your device is running the latest firmware</Text>
      )}

      {state.firmwareInfo.updateAvailable && (
        <Text style={styles.updateReady}>A newer firmware version is available</Text>
      )}

      {lastChecked && (
        <Text style={[styles.lastChecked, { color: colors.textSubtle }]}>Last checked: {lastChecked.toLocaleTimeString()}</Text>
      )}

      {state.firmwareInfo.isUpdating && (
        <View style={styles.progress}>
          <View style={styles.progressInfo}>
            <Text style={{ color: colors.text }}>Updating firmware...</Text>
            <Text style={{ color: colors.text }}>{state.firmwareInfo.updateProgress}%</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${Math.max(0, state.firmwareInfo.updateProgress ?? 0)}%` as any }]} />
          </View>
          <View style={styles.timingInfo}>
            <Text style={{ color: colors.textMuted }}>Elapsed: {formatTime(state.firmwareInfo.elapsedTimeMs || 0)}</Text>
            {state.firmwareInfo.estimatedRemainingTimeMs && (
              <Text style={{ color: colors.textMuted }}>Remaining: {formatTime(state.firmwareInfo.estimatedRemainingTimeMs)}</Text>
            )}
          </View>
          <Text style={styles.warning}>Do not disconnect the device during update</Text>
        </View>
      )}

      {!state.firmwareInfo.isUpdating && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.textSubtle }]}
            onPress={handleCheckForUpdates}
            disabled={isChecking}
          >
            <Text style={styles.buttonText}>{isChecking ? 'Checking...' : 'Check for Updates'}</Text>
          </TouchableOpacity>

          {state.firmwareInfo.updateAvailable && (
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.text }]} onPress={handleStartUpdate}>
              <Text style={styles.buttonText}>Update Firmware</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  text: { fontSize: 14 },
  info: { marginBottom: 12 },
  versionItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 13 },
  versionNumber: { fontSize: 13, fontWeight: '700' },
  upToDate: { fontSize: 13, color: '#38a169', fontWeight: '600', marginBottom: 8 },
  updateReady: { fontSize: 13, color: '#d69e2e', fontWeight: '600', marginBottom: 8 },
  lastChecked: { fontSize: 11, marginBottom: 8 },
  progress: { marginTop: 8 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressBar: {
    height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: { height: '100%', backgroundColor: '#3182ce', borderRadius: 4 },
  timingInfo: { gap: 2, marginBottom: 8 },
  warning: { fontSize: 12, color: '#e53e3e', fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
