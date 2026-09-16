import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTheme } from '../context/ThemeContext'
import { themeColors, Colors } from '../constants/colors'
import { dataStorage } from '../utils/dataStorage'

export default function DataManager() {
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const [recordCount, setRecordCount] = useState(0)
  const [, setStorageSize] = useState(0)

  useEffect(() => {
    updateStats()
    const interval = setInterval(updateStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const updateStats = async () => {
    try {
      const count = await dataStorage.getReadingCount()
      setRecordCount(count)
      const size = await dataStorage.getStorageSize()
      setStorageSize(size)
    } catch (error) {
      console.error('Failed to get storage stats:', error)
    }
  }

  const handleExport = async () => {
    try {
      const data = await dataStorage.exportData()
      const csv = convertToCSV(data)
      const filename = `veetr-data-${new Date().toISOString().split('T')[0]}.csv`
      const file = new File(Paths.cache, filename)
      await file.write(csv)

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri)
      } else {
        Alert.alert('Export Complete', `Data saved to ${filename}`)
      }
    } catch (error) {
      Alert.alert('Export Failed', 'Could not export data. Please try again.')
    }
  }

  const handleClear = () => {
    Alert.alert(
      'Clear All Data',
      `Are you sure you want to delete all ${recordCount} stored records? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await dataStorage.clearAllData()
              await updateStats()
            } catch {
              Alert.alert('Error', 'Failed to clear data.')
            }
          }
        }
      ]
    )
  }

  const maxRecords = dataStorage.getMaxRecords()
  const capacityPercentage = maxRecords > 0 ? (recordCount / maxRecords) * 100 : 0

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Data Storage</Text>

      <View style={styles.stats}>
        <Stat label="Records" value={`${recordCount.toLocaleString()} / ${maxRecords.toLocaleString()}`} colors={colors} />
        <Stat label="Capacity" value={`${capacityPercentage.toFixed(0)}%`} colors={colors} />
      </View>

      {capacityPercentage > 80 && (
        <Text style={styles.warning}>
          Storage is {capacityPercentage.toFixed(0)}% full. Old data will be deleted automatically.
        </Text>
      )}

      <Text style={[styles.info, { color: colors.textSubtle }]}>Sensor data is automatically saved every 10 seconds (averaged).</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.textMuted }]}
          onPress={handleExport}
          disabled={recordCount === 0}
        >
          <Text style={styles.buttonText}>Export CSV</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.danger]}
          onPress={handleClear}
          disabled={recordCount === 0}
        >
          <Text style={styles.buttonText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Stat({ label, value, colors }: { label: string; value: string; colors: Colors }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}:</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  )
}

const convertToCSV = (data: any[]): string => {
  if (data.length === 0) return ''

  const headers = ['Timestamp', 'Date', 'Time', 'AWS (kt)', 'AWA (°)', 'TWS (kt)', 'TWA (°)', 'SOG (kt)', 'HDM (°)', 'Heel (°)', 'Pitch (°)', 'Lat', 'Lon', 'Satellites', 'Samples']
  const rows = data.map(r => {
    const date = new Date(r.timestamp)
    const tws = Math.sqrt(Math.pow(r.AWS * Math.cos(r.AWA * Math.PI / 180) - r.SOG, 2) + Math.pow(r.AWS * Math.sin(r.AWA * Math.PI / 180), 2))
    let twa = Math.atan2(r.AWS * Math.sin(r.AWA * Math.PI / 180), r.AWS * Math.cos(r.AWA * Math.PI / 180) - r.SOG) * 180 / Math.PI
    if (twa < 0) twa += 360

    return [
      r.timestamp,
      date.toISOString().split('T')[0],
      date.toTimeString().split(' ')[0],
      r.AWS.toFixed(2),
      r.AWA.toFixed(1),
      tws.toFixed(2),
      twa.toFixed(1),
      r.SOG.toFixed(2),
      r.HDM.toFixed(1),
      r.heel.toFixed(1),
      r.pitch.toFixed(1),
      r.lat?.toFixed(6) || '',
      r.lon?.toFixed(6) || '',
      r.satellites || '',
      r.sampleCount
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  stats: { marginBottom: 8 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statLabel: { fontSize: 13 },
  statValue: { fontSize: 13, fontWeight: '600' },
  warning: { fontSize: 12, color: '#d69e2e', marginBottom: 8 },
  info: { fontSize: 12, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  danger: { backgroundColor: '#e53e3e' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
