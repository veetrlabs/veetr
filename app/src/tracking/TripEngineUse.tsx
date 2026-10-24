import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { PolarSelect as Picker } from "../polar/PolarSelect";
import { trackingStore } from "./database";
import type { TrackingPoint, TrackingSession } from "./model";
import { propulsionPatch, propulsionSections, splitPropulsion, type Propulsion, type PropulsionSection } from './propulsion';
import { locale, t, translateMessage } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function TripEngineUse({ session, points, index, onSaved }: {
  session: TrackingSession;
  points: TrackingPoint[];
  index: number;
  onSaved: (session: TrackingSession) => void;
}) {
  const c = themeColors[useTheme().theme];
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [undo, setUndo] = useState<PropulsionSection[] | null>(null);
  const saving = useRef(false);
  const sections = propulsionSections(session);
  const selected = points[index];
  const canSplit = index > 0 && index < points.length - 1 && selected &&
    !sections.some(s => s.startedAt === selected.recordedAt);
  const time = (stamp: string) => new Date(stamp).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  async function save(next: PropulsionSection[], isUndo = false) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const patch = propulsionPatch(next);
      await (await trackingStore()).updateTrip(session.id, patch);
      setUndo(isUndo ? null : sections);
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
    <Text style={{ color: c.text, fontWeight: '600' }}>{t('Trip sections')}</Text>
    <Text style={{ color: c.textMuted }}>{t('Select a point on the speed chart, then split the trip there.')}</Text>
    {selected && <Text style={{ color: c.text }}>{t('Selected time')} · {time(selected.recordedAt)}</Text>}
    {button(t('Split at selected time'), () => { if (canSplit) void save(splitPropulsion(session, selected.recordedAt)); }, !canSplit)}
    {sections.map((section, i) => <View key={section.startedAt} style={{ gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ color: c.text, fontWeight: '600' }}>{t('Section')} {i + 1} · {time(i === 0 ? points[0]?.recordedAt ?? section.startedAt : section.startedAt)} – {time(sections[i + 1]?.startedAt ?? points.at(-1)?.recordedAt ?? section.startedAt)}</Text>
      <Picker accessibilityLabel={`${t('Propulsion')} · ${t('Section')} ${i + 1}`} selectedValue={section.propulsion} enabled={!busy}
        onValueChange={value => void save(sections.map((s, n) => n === i ? { ...s, propulsion: value as Propulsion } : s))}>
        <Picker.Item value="unknown" label={t('Unknown')} />
        <Picker.Item value="sailing-only" label={t('Sailing only')} />
        <Picker.Item value="engine-used" label={t('Engine used')} />
      </Picker>
      {i > 0 && button(t('Join with previous section'), () => void save(sections.filter((_, n) => n !== i)))}
    </View>)}
    {sections.length > 1 && <Text style={{ color: c.textMuted }}>{t('Joining keeps the previous section’s propulsion.')}</Text>}
    {undo && button(t('Undo last section edit'), () => void save(undo, true))}
    <Text style={{ color: c.textMuted }}>{t('Motor sections are excluded from sailing comparisons. Unknown sections remain included with a warning.')}</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{translateMessage(error)}</Text>}
  </View>;
}
