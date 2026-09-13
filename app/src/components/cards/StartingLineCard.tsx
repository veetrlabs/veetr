import { View, Text, StyleSheet } from 'react-native'
import { useCardTextSize } from '../../hooks/useCardTextSize'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'

interface StartingLineCardProps {
  hasStartLine: boolean
  distanceToLine: number | null
}

export default function StartingLineCard({ hasStartLine, distanceToLine }: StartingLineCardProps) {
  const { fontSize, unitFontSize, titleFontSize, onCardLayout } = useCardTextSize()
  const { theme } = useTheme()
  const colors = themeColors[theme]

  const formatDistance = () => {
    if (!hasStartLine || distanceToLine === null) return null
    return Math.abs(distanceToLine).toFixed(0)
  }

  const distanceValue = formatDistance()
  const isBehindLine = distanceToLine !== null && distanceToLine < 0

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg }]} onLayout={onCardLayout}>
      <View style={[styles.titleCol, { width: titleFontSize }]}>
        {'Line'.split('').map((char, i) => (
          <Text key={i} style={[styles.title, { color: colors.textSecondary, fontSize: titleFontSize }]}>
            {char}
          </Text>
        ))}
      </View>
      <View style={styles.valueArea}>
        <View style={styles.valueRow}>
          {distanceValue ? (
            <>
              {isBehindLine && <Text style={[styles.minus, { fontSize, color: '#ff9800' }]}>−</Text>}
              <Text style={[styles.number, { color: colors.text, fontSize }]}>{distanceValue}</Text>
              <Text style={[styles.unit, { color: colors.textMuted, fontSize: unitFontSize }]}>m</Text>
            </>
          ) : (
            <Text style={[styles.dash, { color: colors.textMuted, fontSize }]}>--</Text>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    overflow: 'hidden',
  },
  titleCol: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '800',
  },
  valueArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  number: {
    fontWeight: '900',
  },
  unit: {},
  minus: {
    fontWeight: '900',
    marginRight: 2,
  },
  dash: {
    fontWeight: '900',
  },
})
