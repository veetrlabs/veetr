import { View, StyleSheet } from 'react-native'
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg'
import { useSmoothRotation } from '../../hooks/useSmoothRotation'
import { useTheme } from '../../context/ThemeContext'
import { themeColors } from '../../constants/colors'

interface WindAngleCardProps {
  windDirection: number
  trueWindSpeed: number
  trueWindAngle: number
  deadWindAngle: number
  heading: number
}

export default function WindAngleCard({
  windDirection,
  trueWindSpeed,
  trueWindAngle,
  deadWindAngle,
  heading
}: WindAngleCardProps) {
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const smoothWindDirection = useSmoothRotation(windDirection, { duration: 800 })
  const smoothTrueWindAngle = useSmoothRotation(trueWindAngle, { duration: 800 })
  const smoothHeading = useSmoothRotation(heading, { duration: 1000 })

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
      <View style={styles.compassContainer}>
        <Svg viewBox="0 0 500 500" width="100%" height="100%">
          <Circle cx="250" cy="250" r="180" stroke={colors.compassStroke} strokeWidth="4" fill="none" />
          <Circle cx="250" cy="250" r="150" stroke={colors.compassStroke} strokeWidth="2" fill="none" />

          <G transform={`rotate(${smoothHeading} 250 250)`}>
            <Path d="M 245,99 L 250,84 L 255,99 Z" fill={colors.compassFill} />
            <SvgText x="250" y="115" fontSize="12" fontWeight="bold" textAnchor="middle" fill={colors.compassFill}>N</SvgText>
          </G>

          {Array.from({ length: 36 }, (_, i) => {
            const angle = i * 10
            const isCardinal = angle % 90 === 0
            const isMajor = angle % 30 === 0
            const radius = isCardinal ? 165 : isMajor ? 170 : 175
            const endRadius = 180
            const rad = (angle * Math.PI) / 180
            return (
              <Line
                key={angle}
                x1={250 - radius * Math.sin(rad)}
                y1={250 - radius * Math.cos(rad)}
                x2={250 - endRadius * Math.sin(rad)}
                y2={250 - endRadius * Math.cos(rad)}
                stroke={colors.compassStroke}
                strokeWidth={isCardinal ? 3 : isMajor ? 2 : 1}
                opacity={0.5}
              />
            )
          })}

          {Array.from({ length: 11 }, (_, i) => {
            const angle = i * 30
            if (angle === 0) return null
            const radius = 195
            const rad = (angle * Math.PI) / 180
            return (
              <G key={angle}>
                {angle <= 180 && (
                  <SvgText
                    x={250 - radius * Math.sin(rad)}
                    y={250 - radius * Math.cos(rad) + 4}
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    fill={colors.compassFill}
                  >
                    {angle}
                  </SvgText>
                )}
                {angle < 180 && (
                  <SvgText
                    x={250 + radius * Math.sin(rad)}
                    y={250 - radius * Math.cos(rad) + 4}
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    fill={colors.compassFill}
                  >
                    {angle}
                  </SvgText>
                )}
              </G>
            )
          })}

          <Path
            d={`M 250,222 Q 264,250 257,278 Q 250,285 243,278 Q 236,250 250,222 Z`}
            fill={colors.compassAccent}
            stroke={colors.text}
            strokeWidth="2"
          />
          <Circle cx="250" cy="250" r="5" fill={colors.text} stroke={colors.cardBg} strokeWidth="2" />

          <Path
            d={`M 250,250 L ${250 + 180 * Math.sin((deadWindAngle * Math.PI) / 180)},${250 - 180 * Math.cos((deadWindAngle * Math.PI) / 180)} M 250,250 L ${250 - 180 * Math.sin((deadWindAngle * Math.PI) / 180)},${250 - 180 * Math.cos((deadWindAngle * Math.PI) / 180)}`}
            stroke="#e53e3e"
            strokeWidth="4"
            opacity={0.6}
          />

          <G transform={`rotate(${smoothWindDirection} 250 250)`}>
            <Path d="M 240,70 L 250,250 L 260,70" fill={colors.text} opacity={0.95} />
            <Circle cx="250" cy="80" r="8" fill={colors.text} />
          </G>

          {trueWindSpeed > 0 && trueWindAngle > 0 && (
            <G transform={`rotate(${smoothTrueWindAngle} 250 250)`}>
              <Path d="M 240,70 L 250,100 L 260,70 Z" fill={colors.text} stroke={colors.text} strokeWidth="1" opacity={0.8} />
            </G>
          )}
        </Svg>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassContainer: {
    width: '100%',
    aspectRatio: 1,
  },
})
