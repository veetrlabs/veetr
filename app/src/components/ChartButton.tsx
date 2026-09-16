import { TouchableOpacity, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'

interface ChartButtonProps {
  onPress: () => void
}

export default function ChartButton({ onPress }: ChartButtonProps) {
  const { theme } = useTheme()
  const colors = themeColors[theme]
  const insets = useSafeAreaInsets()

  return (
    <TouchableOpacity style={[styles.button, { backgroundColor: colors.buttonBg, bottom: insets.bottom + 88 }]} onPress={onPress}>
      <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M18 20V10" />
        <Path d="M12 20V4" />
        <Path d="M6 20v-6" />
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
