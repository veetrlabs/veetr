import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../context/ThemeContext'
import { themeColors, Colors } from '../../constants/colors'
import { dataStorage } from '../../utils/dataStorage'

interface DataPoint {
  timestamp: number
  AWS: number
  TWS: number
  SOG: number
}

export default function HistoryTab() {
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const insets = useSafeAreaInsets()
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
  }, [timeRange])

  const stats = getStats(data)

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top + 8 }]}>
      <Text style={[styles.title, { color: colors.text }]}>Historical Data</Text>

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

      <ScrollView style={styles.scroll}>
        {loading ? (
          <Text style={[styles.status, { color: colors.textMuted }]}>Loading data...</Text>
        ) : data.length === 0 ? (
          <Text style={[styles.status, { color: colors.textMuted }]}>No data available for this time range</Text>
        ) : (
          <>
            <SimpleBarChart data={data} colors={colors} />
            <View style={styles.legend}>
              <Legend color="#2196F3" label="AWS" />
              <Legend color="#4CAF50" label="TWS" />
              <Legend color="#FF9800" label="SOG" />
            </View>
            <StatsSection stats={stats} colors={colors} />
          </>
        )}
      </ScrollView>
    </View>
  )
}

function getStats(data: DataPoint[]) {
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
  const chartWidth = screenWidth - 64
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: '#718096' }}>{label}</Text>
    </View>
  )
}

function StatsSection({ stats, colors }: { stats: ReturnType<typeof getStats>; colors: Colors }) {
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
  container: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  scroll: { flex: 1 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, justifyContent: 'center' },
  rangeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  rangeText: { fontSize: 12, fontWeight: '600' },
  status: { textAlign: 'center', padding: 40, fontSize: 16 },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginVertical: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, marginBottom: 32 },
  statGroup: { alignItems: 'center' },
  statTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  statValue: { fontSize: 12 },
})
