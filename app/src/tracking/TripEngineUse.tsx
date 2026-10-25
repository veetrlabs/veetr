import { sectionStatistics } from './sectionStatistics';
import { useMemo, useRef, useState } from "react";
import { Modal, ScrollView, Pressable, Text, View } from "react-native";
import { PolarSelect as Picker } from "../polar/PolarSelect";
import { trackingStore } from "./database";
import type { TrackingPoint, TrackingSession } from "./model";
import { propulsionPatch, propulsionSections, splitPropulsion, type Propulsion, type PropulsionSection } from './propulsion';
import { formatNumber, locale, t, translateMessage } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function TripEngineUse({ session, points, index, range, onSaved }: {
  session: TrackingSession;
  points: TrackingPoint[];
  index: number;
  range?: [number, number];
  onSaved: (session: TrackingSession) => void;
}) {
  const c = themeColors[useTheme().theme];
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [undo, setUndo] = useState<PropulsionSection[] | null>(null);
  const saving = useRef(false);
  const sections = propulsionSections(session);
  const selected = points[index];
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeStart, setActiveStart] = useState<string>();
  const chartSection = sections.filter(s => Date.parse(s.startedAt) <= Date.parse(selected?.recordedAt ?? '')).at(-1)?.startedAt;
  const activeIndex = Math.max(0, sections.findIndex(s => s.startedAt === (activeStart ?? chartSection)));
  const sectionStart = sections[activeIndex]?.startedAt;
  const sectionEnd = sections[activeIndex + 1]?.startedAt;
  const statistics = useMemo(() => sectionStatistics(points, sections, activeIndex), [points, activeIndex, sectionStart, sectionEnd]);
  const start = range?.[0] ?? Date.parse(points[0]?.recordedAt ?? session.startedAt);
  const end = range?.[1] ?? Date.parse(points.at(-1)?.recordedAt ?? session.startedAt);
  const label = (propulsion: Propulsion) => t(propulsion === 'sailing-only' ? 'Sailing only' : propulsion === 'engine-used' ? 'Engine used' : 'Unknown');
  const canSplit = index > 0 && index < points.length - 1 && selected &&
    !sections.some(s => s.startedAt === selected.recordedAt) && chartSection === sections[activeIndex]?.startedAt;
  const time = (stamp: string) => new Date(stamp).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  async function save(next: PropulsionSection[], isUndo = false, focus?: string) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const patch = propulsionPatch(next);
      await (await trackingStore()).updateTrip(session.id, patch);
      setUndo(isUndo ? null : sections);
      if (focus) setActiveStart(focus);
      onSaved({ ...session, ...patch });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { saving.current = false; setBusy(false); }
  }
  const button = (label: string, action: () => void, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled}
      accessibilityState={{ disabled: busy || disabled }} onPress={action}
      style={({ pressed }) => ({ minHeight: 44, padding: 12, borderRadius: 8, borderWidth: 1,
        borderColor: c.border, backgroundColor: c.buttonBg, opacity: busy || disabled ? .45 : pressed ? .7 : 1 })}>
      <Text style={{ color: c.text }}>{label}</Text>
    </Pressable>
  );
  return <View style={{ gap: 12 }}>
    <View accessibilityLabel={t('Trip sections')} style={{ marginLeft: 32, marginRight: 12, flexDirection: 'row', height: 22, gap: 2 }}>
      {sections.map((section, i) => {
        const from = Math.max(start, i === 0 ? start : Date.parse(section.startedAt));
        const to = Math.min(end, Date.parse(sections[i + 1]?.startedAt ?? points.at(-1)?.recordedAt ?? session.startedAt));
        if (!Number.isFinite(from + to) || to < from || (to === from && end > start)) return null;
        return <Pressable key={section.startedAt} accessibilityRole="button"
          accessibilityLabel={`${t('Section')} ${i + 1} · ${label(section.propulsion)} · ${time(from === start && i === 0 ? points[0]?.recordedAt ?? section.startedAt : section.startedAt)}`}
          accessibilityState={{ selected: i === activeIndex }} onPress={() => { setActiveStart(section.startedAt); setEditorOpen(true); }}
          style={({ pressed }) => ({ flex: Math.max(1, to - from), borderRadius: 5, borderWidth: i === activeIndex ? 3 : 1,
            borderColor: i === activeIndex ? c.text : c.bg, backgroundColor: section.propulsion === 'sailing-only' ? '#008c80' : section.propulsion === 'engine-used' ? '#64748b' : '#b7791f',
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden', opacity: pressed ? .65 : 1 })}>
          <Text numberOfLines={1} style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>{i + 1}</Text>
        </Pressable>;
      })}
    </View>
    {editorOpen && <Modal transparent animationType="fade" onRequestClose={() => setEditorOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View accessibilityViewIsModal style={{ maxHeight: '85%', borderRadius: 16, backgroundColor: c.bg, padding: 16 }}>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
    {selected && <Text style={{ color: c.text }}>{t('Selected time')} · {time(selected.recordedAt)}</Text>}
    {button(t('Split at selected time'), () => { if (canSplit) void save(splitPropulsion(session, selected.recordedAt), false, selected.recordedAt); }, !canSplit)}
    {sections.map((section, i) => i === activeIndex && <View key={section.startedAt} style={{ gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ color: c.text, fontWeight: '600' }}>{t('Section')} {i + 1} · {time(i === 0 ? points[0]?.recordedAt ?? section.startedAt : section.startedAt)} – {time(sections[i + 1]?.startedAt ?? points.at(-1)?.recordedAt ?? section.startedAt)}</Text>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Text style={{ flex: 1, color: c.textMuted, fontSize: 12 }}>knots</Text>
          {['Min', 'Max', 'Average'].map(title => <Text key={title} style={{ flex: 1, textAlign: 'right', color: c.textMuted, fontSize: 12 }}>{t(title)}</Text>)}
        </View>
        {statistics.map(row => <View key={row.metric} style={{ flexDirection: 'row', gap: 4 }}>
          <Text style={{ flex: 1, color: c.text, fontWeight: '600' }}>{row.metric.toUpperCase()}</Text>
          {[row.min, row.max, row.average].map((value, n) => <Text key={n} style={{ flex: 1, textAlign: 'right', color: c.text, fontVariant: ['tabular-nums'] }}>{value === null ? '—' : formatNumber(value, 1)}</Text>)}
        </View>)}
      </View>
      <Picker accessibilityLabel={`${t('Propulsion')} · ${t('Section')} ${i + 1}`} selectedValue={section.propulsion} enabled={!busy}
        onValueChange={value => void save(sections.map((s, n) => n === i ? { ...s, propulsion: value as Propulsion } : s))}>
        <Picker.Item value="unknown" label={t('Unknown')} />
        <Picker.Item value="sailing-only" label={t('Sailing only')} />
        <Picker.Item value="engine-used" label={t('Engine used')} />
      </Picker>
      {sections.length > 1 && <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>{i > 0 && button(t('← Join left'), () => void save(
          sections.filter((_, n) => n !== i).map((s, n) => n === i - 1 ? { ...s, propulsion: section.propulsion } : s),
          false, sections[i - 1].startedAt))}</View>
        <View style={{ flex: 1 }}>{i < sections.length - 1 && button(t('Join right →'), () => void save(
          sections.filter((_, n) => n !== i + 1), false, section.startedAt))}</View>
      </View>}
    </View>)}
    {sections.length > 1 && <Text style={{ color: c.textMuted }}>{t('Joining keeps the selected section’s propulsion.')}</Text>}
    {undo && button(t('Undo last section edit'), () => void save(undo, true))}
    <Text style={{ color: c.textMuted }}>{t('Motor sections are excluded from sailing comparisons. Unknown sections remain included with a warning.')}</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{translateMessage(error)}</Text>}
    {button(t('Close'), () => setEditorOpen(false))}
          </ScrollView>
        </View>
      </View>
    </Modal>}
  </View>;
}
