import { propulsionAt, propulsionPatch, splitPropulsion } from '../propulsion';
import type { TrackingSession } from '../model';
const session = {startedAt:'2026-10-24T12:00:00Z',engineUse:'engine-used'} as TrackingSession;
test('legacy classification survives splitting and exact boundaries belong to the new section',()=>{
 const split=splitPropulsion(session,'2026-10-24T12:10:00Z');
 expect(split.map(s=>s.propulsion)).toEqual(['engine-used','engine-used']);
 split[1].propulsion='sailing-only';
 const mixed={...session,...propulsionPatch(split)};
 expect(mixed.engineUse).toBe('engine-used');
 expect(propulsionAt(mixed,'2026-10-24T11:59:59Z')).toBe('engine-used');
 expect(propulsionAt(mixed,'2026-10-24T12:09:59Z')).toBe('engine-used');
 expect(propulsionAt(mixed,'2026-10-24T12:10:00Z')).toBe('sailing-only');
 expect(propulsionAt(mixed,'2026-10-25T12:10:00Z')).toBe('sailing-only');
 expect(splitPropulsion(mixed,'2026-10-24T12:10:00Z')).toHaveLength(2);
});
