import { formatNumber, t, useLanguageRefresh } from '../i18n';
import { shouldUseDeviceStartLine } from '../navigation/phoneStartLine'
import { phoneStartLineDistance, startLineDistanceAtPosition } from '../navigation/startLineDistance'
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '../navigation/NavigationContext'
import { compassBearings } from '../navigation/phoneHeading'
import { useTheme } from '../context/ThemeContext'
import { themeColors } from '../constants/colors'
import { useBLE } from '../context/BLEContext'
import WindAngleCard from './cards/WindAngleCard'
import { visibleVaneHeading } from '../utils/compassTelemetry'

const number = (value: number | null | undefined, decimals = 0) => value == null || !Number.isFinite(value) ? '—' : formatNumber(value, decimals)
const angle = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${Math.round(value) % 360}°`

export default function Dashboard() {
  useLanguageRefresh();
  const nav = useNavigation(), { state } = useBLE(), { theme } = useTheme()
  const colors = themeColors[theme], insets = useSafeAreaInsets(), d = state.sailingData
  const [space, setSpace] = useState({ width: 0, height: 0 })
  const landscape = space.width > space.height * 1.15
  const headingReading = visibleVaneHeading(d.recordingInstruments?.heading ?? null, d.compass)
  const deviceHeading = headingReading.heading
  const device = nav.deviceFresh
  const phoneLine = nav.phoneStartLine.line
  const localLine = !shouldUseDeviceStartLine(state.isConnected, nav.phoneStartLine)
  const showPhoneDistance = !device && localLine && !!phoneLine.port && !!phoneLine.starboard
  const phoneDistance = localLine ? (device && nav.fix?.source === 'Veetr GPS'
    ? startLineDistanceAtPosition(phoneLine, nav.fix)
    : phoneStartLineDistance(phoneLine, nav.permission ? nav.phonePoint : null)) : null
  const bearings = compassBearings(nav.fix?.course ?? null, nav.phoneHeading.sample, Date.now())
  // The tab navigator already reserves its bottom bar. Measure only the remaining instrument area.
  const compassSize = Math.max(0, Math.min(landscape ? space.width * 0.46 : space.width, landscape ? space.height : device ? space.height * 0.5 : Math.max(0, space.height - (showPhoneDistance ? 260 : 210))))
  const panelWidth = landscape ? space.width - compassSize - 12 : space.width
  const panelHeight = landscape ? space.height : space.height - compassSize - 8
  const lineHeight = showPhoneDistance ? Math.max(0, panelHeight * 0.22) : 0
  const speedHeight = Math.max(0, panelHeight * (device ? 0.43 : showPhoneDistance ? 0.48 : 0.6))
  const speedFont = Math.max(12, Math.min(panelWidth / 3.5, speedHeight * 0.64, 150))
  const rows = device ? 4 : 1
  const secondaryFont = Math.max(10, Math.min(speedFont * 0.48, (panelHeight - speedHeight - lineHeight) / rows * 0.48, panelWidth / 9, 48))
  const metrics = [
    { label: 'COG', value: angle(nav.fix?.course) },
    { label: bearings.reference === 'true' ? 'HDG · T' : 'HDG · M', value: angle(bearings.heading) },
  ]
  const vaneMetrics = [
    { label: 'AWS', value: number(d.windSpeed, 1), unit: 'kn' },
    { label: 'AWA', value: number(d.windAngle), unit: '°' },
    { label: 'TWS', value: number(d.trueWindSpeed, 1), unit: 'kn' },
    { label: 'TWA', value: number(d.trueWindAngle), unit: '°' },
    { label: 'SOG', value: number(nav.fix?.sogKnots, 1), unit: 'kn' },
    { label: headingReading.uncertain ? t('HDG · uncertain') : 'HDG', value: `${headingReading.uncertain ? '~' : ''}${number(deviceHeading)}`, unit: '°' },
    { label: t('Line'), value: localLine ? number(phoneDistance) : d.hasStartLine ? number(d.distanceToLine) : '—', unit: 'm' },
    { label: t('HEEL'), value: number(d.tilt), unit: '°' },
  ]
  const vaneFont = Math.max(12, Math.min(panelHeight / 4 * 0.68, panelWidth / 2 * 0.29, 120))
  return <View style={[styles.screen, { paddingTop: insets.top + 4, paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right) }]}>
    <View style={styles.instrumentArea} onLayout={e => setSpace(e.nativeEvent.layout)}>
      <View style={[styles.layout, { flexDirection: landscape ? 'row' : 'column' }]}>
        <View style={{ width: compassSize, height: compassSize, alignSelf: 'center' }}>
          <WindAngleCard
            heading={device ? deviceHeading : bearings.heading}
            course={device ? null : bearings.course}
            showWind={device}
            windDirection={d.windDirection}
            trueWindSpeed={d.trueWindSpeed}
            trueWindAngle={d.trueWindAngle}
            deadWindAngle={d.deadWindAngle}
          />
        </View>
        <View style={styles.numbers}>
          {device ? <View style={styles.metrics}>
            {vaneMetrics.map(metric => <View key={metric.label} accessibilityLabel={`${metric.label} ${metric.value} ${metric.value === '—' ? '' : metric.unit}`} style={styles.vaneMetric}>
              <View style={styles.verticalLabel}>
                <Text numberOfLines={1} style={{ width: 64, textAlign: 'center', transform: [{ rotate: '-90deg' }], color: colors.textSecondary, fontSize: Math.max(10, Math.min(15, vaneFont * 0.23)), fontWeight: '800' }}>{metric.label}</Text>
              </View>
              <View style={styles.vaneValue}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, color: colors.text, fontSize: vaneFont, lineHeight: vaneFont * 1.12, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{metric.value}</Text>
                {metric.value !== '—' && <Text style={{ color: colors.textSecondary, fontSize: Math.max(10, vaneFont * 0.2), fontWeight: '700', marginTop: vaneFont * 0.12 }}>{metric.unit}</Text>}
              </View>
            </View>)}
          </View> : <>
          <View style={{ height: speedHeight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: Math.max(10, Math.min(16, speedFont * 0.18)), fontWeight: '700', letterSpacing: 2 }}>SOG</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: speedFont, lineHeight: speedFont * 1.08, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{number(nav.fix?.sogKnots, 1)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: speedFont * 0.23 }}>kn</Text>
            </View>
          </View>
          {showPhoneDistance && <View style={{ height: lineHeight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{t("START LINE · m")}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: secondaryFont, lineHeight: secondaryFont * 1.12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{number(phoneDistance)}</Text>
          </View>}
          <View style={styles.metrics}>
            {metrics.map(metric => <View key={metric.label} style={{ width: '50%', height: `${100 / rows}%`, alignItems: 'center', justifyContent: 'center' }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.textMuted, fontSize: Math.max(9, Math.min(12, secondaryFont * 0.35)), fontWeight: '600' }}>{metric.label}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: secondaryFont, lineHeight: secondaryFont * 1.12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{metric.value}</Text>
            </View>)}
          </View>
          </>}
        </View>
      </View>
    </View>
  </View>
}
const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, paddingBottom: 4, gap: 4 },
  instrumentArea: { flex: 1, minHeight: 0 },
  layout: { flex: 1, minHeight: 0, gap: 8 },
  vaneMetric: { width: '50%', height: '25%', flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  verticalLabel: { width: 24, alignItems: 'center', justifyContent: 'center' },
  vaneValue: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 2 },
  numbers: { flex: 1, minHeight: 0 },
  metrics: { flex: 1, minHeight: 0, flexDirection: 'row', flexWrap: 'wrap' },
})
