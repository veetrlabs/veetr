import { Pressable, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../constants/colors';
import { t, useLanguageRefresh } from '../i18n';

export default function BackButton({ onPress }: { onPress: () => void }) {
  useLanguageRefresh();
  const colors = themeColors[useTheme().theme];
  return <Pressable accessible accessibilityRole="button" accessibilityLabel={t('Back')}
    onPress={onPress} hitSlop={4}
    style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
      minHeight: 44, minWidth: 44, paddingRight: 12, gap: 6, opacity: pressed ? 0.5 : 1 })}>
    <Text accessible={false} style={{ color: colors.text, fontSize: 30, lineHeight: 32 }}>‹</Text>
    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>{t('Back')}</Text>
  </Pressable>;
}
