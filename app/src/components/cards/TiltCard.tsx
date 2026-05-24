import { memo } from 'react'
import { View, Text } from 'react-native'
import { useCardTextSize } from '../../hooks/useCardTextSize'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'
import { cardStyles } from './shared'

interface TiltCardProps {
  tilt: number
}

const TiltCard = memo(function TiltCard({ tilt }: TiltCardProps) {
  const { fontSize, unitFontSize, titleFontSize, onCardLayout } = useCardTextSize()
  const { theme } = useTheme()
  const colors = themeColors[theme]

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.cardBg }]} onLayout={onCardLayout}>
      <View style={[cardStyles.titleCol, { width: titleFontSize }]}>
        {'HEEL'.split('').map((char, i) => (
          <Text key={i} style={[cardStyles.title, { color: colors.textSecondary, fontSize: titleFontSize }]}>
            {char}
          </Text>
        ))}
      </View>
      <View style={cardStyles.valueArea}>
        <View style={cardStyles.valueRow}>
          <Text style={[cardStyles.number, { color: colors.text, fontSize }]}>{Math.abs(tilt).toFixed(0)}</Text>
          <Text style={[cardStyles.unit, { color: colors.textMuted, fontSize: unitFontSize }]}>°</Text>
        </View>
      </View>
    </View>
  )
})

export default TiltCard
