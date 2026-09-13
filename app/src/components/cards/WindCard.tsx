import { memo } from 'react'
import { View, Text } from 'react-native'
import { useCardTextSize } from '../../hooks/useCardTextSize'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'
import { cardStyles } from './shared'

interface WindCardProps {
  windSpeed: number
  title: string
}

const WindCard = memo(function WindCard({ windSpeed, title }: WindCardProps) {
  const { fontSize, unitFontSize, titleFontSize, onCardLayout } = useCardTextSize()
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const isTrue = title.toLowerCase().includes('true')
  const label = isTrue ? 'TWS' : 'AWS'

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.cardBg }]} onLayout={onCardLayout}>
      <View style={[cardStyles.titleCol, { width: titleFontSize }]}>
        {label.split('').map((char, i) => (
          <Text key={i} style={[cardStyles.title, { color: colors.textSecondary, fontSize: titleFontSize }]}>
            {char}
          </Text>
        ))}
      </View>
      <View style={cardStyles.valueArea}>
        <View style={cardStyles.valueRow}>
          <Text style={[cardStyles.number, { color: colors.text, fontSize }]}>{windSpeed > 0 ? windSpeed.toFixed(1) : '0.0'}</Text>
          <Text style={[cardStyles.unit, { color: colors.textMuted, fontSize: unitFontSize }]}>kt</Text>
        </View>
      </View>
    </View>
  )
})

export default WindCard
