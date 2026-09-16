import { TouchableOpacity, StyleSheet } from 'react-native'
import Svg, { Polygon, Line } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'

interface MapButtonProps {
  onPress: () => void
}

export default function MapButton({ onPress }: MapButtonProps) {
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const insets = useSafeAreaInsets()

  return (
    <TouchableOpacity style={[styles.button, { backgroundColor: colors.buttonBg, bottom: insets.bottom + 20 }]} onPress={onPress}>
      <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <Line x1="8" y1="2" x2="8" y2="18" />
        <Line x1="16" y1="6" x2="16" y2="22" />
      </Svg>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
})
