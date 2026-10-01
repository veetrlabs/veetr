import { distinctCourse, courseUpBearing, KNOTS_PER_MPS } from '../courseVector';
import { boatSymbol } from '../boatSymbol';
const reading = { cogDeg: 90, sogMps: 2 / KNOTS_PER_MPS, instruments: { heading: 60 } };
test('second vector needs speed above one knot and a distinct heading', () => {
 expect(distinctCourse(reading)).toBe(90);
 expect(distinctCourse({ ...reading, sogMps: 1 / KNOTS_PER_MPS })).toBeNull();
 expect(distinctCourse({ ...reading, sogMps: null })).toBeNull();
 expect(distinctCourse({ ...reading, instruments: undefined })).toBeNull();
 expect(distinctCourse({ ...reading, cogDeg: 62 })).toBeNull();
 expect(distinctCourse({ ...reading, cogDeg: 1, instruments: { heading: 359 } })).toBeNull();
});
test('course-up holds its last direction at low speed and never substitutes uncalibrated heading', () => {
 expect(courseUpBearing(null, reading)).toBe(90);
 expect(courseUpBearing(90, { ...reading, sogMps: 0 })).toBe(90);
 expect(courseUpBearing(null, { ...reading, cogDeg: null })).toBe(0);
});
test('screen-facing boat and wind glyph compensate for map rotation together', () => {
 const svg = boatSymbol({ ...reading, instruments: { heading: 60, awa: 20, twa: -20 } }, '#008c80', 90);
 expect(svg).toContain('rotate(-90 56 56)');
 expect(svg).toContain('rotate(60 56 56)');
 expect(svg).toContain('rotate(80 56 56)');
 expect(svg).toContain('rotate(40 56 56)');
});
