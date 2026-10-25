import type { TrackingSession } from './model';
export type Propulsion = 'unknown' | 'sailing-only' | 'engine-used';
export type PropulsionSection = { startedAt: string; propulsion: Propulsion };

// Boundaries belong to the following section. The first section covers earlier fixes too.
export function propulsionSections(session: TrackingSession): PropulsionSection[] {
  return session.propulsionSections?.length ? session.propulsionSections : [
    { startedAt: session.startedAt, propulsion: session.engineUse ?? 'unknown' },
  ];
}
export function propulsionAt(session: TrackingSession, recordedAt: string): Propulsion {
  const sections = propulsionSections(session);
  let propulsion = sections[0].propulsion;
  for (const section of sections) {
    if (Date.parse(section.startedAt) > Date.parse(recordedAt)) break;
    propulsion = section.propulsion;
  }
  return propulsion;
}
export function splitPropulsion(session: TrackingSession, recordedAt: string): PropulsionSection[] {
  const sections = propulsionSections(session);
  if (sections.some(s => Date.parse(s.startedAt) === Date.parse(recordedAt))) return sections;
  return [...sections, { startedAt: recordedAt, propulsion: propulsionAt(session, recordedAt) }]
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}
export function propulsionPatch(sections: PropulsionSection[]) {
  // Conservative summary for older readers that do not understand sections.
  const engineUse: Propulsion = sections.some(s => s.propulsion === 'engine-used') ? 'engine-used'
    : sections.every(s => s.propulsion === 'sailing-only') ? 'sailing-only' : 'unknown';
  return { propulsionSections: sections, engineUse };
}
