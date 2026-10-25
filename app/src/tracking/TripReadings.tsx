import { Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../constants/colors';
import { formatNumber, locale, t } from '../i18n';
import type { TrackingPoint } from './model';
import { metricValue } from './trip';
import { chartMetrics } from './chartSeries';

export default function TripReadings({ point }: { point?: TrackingPoint }) {
  const c = themeColors[useTheme().theme];
  const readings = [
    { key: 'time', label: t('Time').toLocaleUpperCase(), color: c.textMuted,
      value: point ? new Date(point.recordedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—' },
    ...chartMetrics.map(metric => {
      const value = point ? metricValue(point, metric.key) : null;
      return { key: metric.key, label: `${metric.label} · kn`, color: metric.color,
        value: value === null ? '—' : formatNumber(value, 1) };
    }),
  ];
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
    {readings.map(reading => <View key={reading.key} style={{ flex: reading.key === 'time' ? 1.4 : 1, minWidth: reading.key === 'time' ? 100 : 58, gap: 4 }}>
      <Text style={{ color: reading.color, fontSize: 11, fontWeight: '600' }}>{reading.label}</Text>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{reading.value}</Text>
    </View>)}
  </View>;
}
