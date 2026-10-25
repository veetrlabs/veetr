import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../constants/colors';
import { formatNumber, t } from '../i18n';
import type { TrackingPoint } from './model';
import { speedStatistics } from './sectionStatistics';

export default function TripStatistics({ points }: { points: TrackingPoint[] }) {
  const c = themeColors[useTheme().theme];
  const rows = useMemo(() => speedStatistics(points), [points]);
  return <View style={{ gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: c.text, fontWeight: '600' }}>{t('Whole trip')} · knots</Text>
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flex: 1 }} />
      {[t('Max'), t('Average')].map(label => <Text key={label} style={{ flex: 1, textAlign: 'right', color: c.textMuted }}>{label}</Text>)}
    </View>
    {rows.map(row => <View key={row.metric} style={{ flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border }}>
      <Text style={{ flex: 1, color: c.text }}>{row.metric.toUpperCase()}</Text>
      {[row.max, row.average].map((value, i) => <Text key={i} style={{ flex: 1, textAlign: 'right', color: c.text, fontVariant: ['tabular-nums'] }}>
        {value === null ? '—' : formatNumber(value, 1)}
      </Text>)}
    </View>)}
  </View>;
}
