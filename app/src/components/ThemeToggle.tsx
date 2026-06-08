import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const colors = themeColors[theme]
  const isLight = theme === 'light'

  return (
    <TouchableOpacity style={[styles.button, { backgroundColor: colors.buttonBg }]} onPress={toggleTheme}>
      {isLight ? (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="5" />
          <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </Svg>
      ) : (
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </Svg>
      )}
      <Text style={[styles.text, { color: colors.text }]}>{isLight ? 'Dark' : 'Light'}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  text: { fontSize: 14, fontWeight: '600' },
})
