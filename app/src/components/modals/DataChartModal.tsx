import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Dimensions } from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { themeColors, Colors } from '../../constants/colors'
import { dataStorage } from '../../utils/dataStorage'

interface DataPoint {
  timestamp: number
  AWS: number
  TWS: number
  SOG: number
}

interface DataChartModalProps {
  visible: boolean
  onClose: () => void
}

export default function DataChartModal({ visible, onClose }: DataChartModalProps) {
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const [data, setData] = useState<DataPoint[]>([])
  const [timeRange, setTimeRange] = useState(10)
  const [loading, setLoading] = useState(true)

  const calculateTWS = (aws: number, awa: number, sog: number): number => {
    if (sog < 0.5) return aws
    const awaRad = (awa * Math.PI) / 180
    const twsX = aws * Math.cos(awaRad) - sog
    const twsY = aws * Math.sin(awaRad)
    return Math.sqrt(twsX * twsX + twsY * twsY)
  }

  useEffect(() => {
    if (!visible) return
    const loadData = async () => {
      setLoading(true)
      const now = Date.now()
      const startTime = now - timeRange * 60 * 1000
      const readings = await dataStorage.getReadings(startTime, now)
      const processed = readings.map(r => ({
        timestamp: r.timestamp,
        AWS: r.AWS,
        TWS: calculateTWS(r.AWS, r.AWA, r.SOG),
        SOG: r.SOG,
      }))
      setData(processed)
      setLoading(false)
    }
    loadData()
  }, [visible, timeRange])

  const stats = getChartStats(data)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.panelBg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Performance Data</Text>
            <TouchableOpacity onPress={onClose}><Text style={[styles.close, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView>
            <View style={styles.rangeRow}>
              {[10, 60, 720, 1440].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.rangeBtn, { backgroundColor: colors.chartBg }, timeRange === m && { backgroundColor: colors.text }]}
                  onPress={() => setTimeRange(m)}
                >
                  <Text style={[styles.rangeText, { color: colors.textSecondary }, timeRange === m && { color: colors.chartBg }]}>
                    {m < 60 ? `${m}min` : m < 1440 ? `${m / 60}h` : `${m / 1440}d`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading ? (
              <Text style={[styles.loading, { color: colors.textMuted }]}>Loading data...</Text>
            ) : data.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No data available for this time range</Text>
            ) : (
              <>
                <SimpleBarChart data={data} colors={colors} />
                <View style={styles.legend}>
                  <Legend color="#2196F3" label="AWS" theme={theme} />
                  <Legend color="#4CAF50" label="TWS" theme={theme} />
                  <Legend color="#FF9800" label="SOG" theme={theme} />
                </View>
                <StatsSection stats={stats} colors={colors} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function getChartStats(data: DataPoint[]) {
  if (data.length === 0) return { aws: { min: 0, max: 0, avg: 0 }, tws: { min: 0, max: 0, avg: 0 }, sog: { min: 0, max: 0, avg: 0 } }

  const calc = (arr: number[]) => ({
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  })

  return {
    aws: calc(data.map(d => d.AWS)),
    tws: calc(data.map(d => d.TWS)),
    sog: calc(data.map(d => d.SOG)),
  }
}

function SimpleBarChart({ data, colors }: { data: DataPoint[]; colors: Colors }) {
  const { width: screenWidth } = Dimensions.get('window')
  const chartWidth = screenWidth - 80
  const chartHeight = 200

  const maxVal = Math.max(...data.flatMap(d => [d.AWS, d.TWS, d.SOG]), 1)
  const groupWidth = Math.max(6, (chartWidth / data.length) - 2)
  const barWidth = Math.max(2, groupWidth / 3 - 1)

  return (
    <View style={{ height: chartHeight + 40, marginVertical: 12 }}>
      <View style={{ flexDirection: 'row', height: chartHeight, alignItems: 'flex-end', gap: 2 }}>
        {data.map((point, i) => (
          <View key={i} style={{ width: groupWidth, flexDirection: 'row', gap: 1 }}>
            <View style={{ width: barWidth, height: (point.AWS / maxVal) * chartHeight, backgroundColor: '#2196F3', opacity: 0.7 }} />
            <View style={{ width: barWidth, height: (point.TWS / maxVal) * chartHeight, backgroundColor: '#4CAF50', opacity: 0.7 }} />
            <View style={{ width: barWidth, height: (point.SOG / maxVal) * chartHeight, backgroundColor: '#FF9800', opacity: 0.7 }} />
          </View>
        ))}
      </View>
    </View>
  )
}

function Legend({ color, label, theme }: { color: string; label: string; theme: 'light' | 'dark' }) {
  const colors = themeColors[theme]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: colors.textMuted }}>{label}</Text>
    </View>
  )
}

function StatsSection({ stats, colors }: { stats: ReturnType<typeof getChartStats>; colors: Colors }) {
  const renderStat = (title: string, data: { min: number; max: number; avg: number }) => (
    <View style={styles.statGroup}>
      <Text style={[styles.statTitle, { color: colors.text }]}>{title} (kt)</Text>
      <Text style={[styles.statValue, { color: colors.textMuted }]}>Min: {data.min.toFixed(1)}</Text>
      <Text style={[styles.statValue, { color: colors.textMuted }]}>Avg: {data.avg.toFixed(1)}</Text>
      <Text style={[styles.statValue, { color: colors.textMuted }]}>Max: {data.max.toFixed(1)}</Text>
    </View>
  )

  return (
    <View style={styles.statsRow}>
      {renderStat('AWS', stats.aws)}
      {renderStat('TWS', stats.tws)}
      {renderStat('SOG', stats.sog)}
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  close: { fontSize: 22, padding: 4 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  rangeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  rangeText: { fontSize: 12, fontWeight: '600' },
  loading: { textAlign: 'center', padding: 20 },
  empty: { textAlign: 'center', padding: 20 },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginVertical: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  statGroup: { alignItems: 'center' },
  statTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  statValue: { fontSize: 12 },
})
