import { midpoint, startGeometry, validateCourse, type CoursePoint, type RaceCourse } from './course';
const xml = (value: string) => value.replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function courseGpx(course: RaceCourse, name: string): string {
  validateCourse(course);
  const ends = startGeometry(course);
  const knownLine = !!course.startLine || !!course.startBearing?.distanceMetres;
  const marks = course.marks.map((mark, i) => ({point: mark, name: `Mark ${i + 1}`, description: `Leave to ${mark.rounding === 'port' ? 'port (left)' : 'starboard (right)'}`}));
  const start = ends[0] ? [{point: ends[0], name: 'Start A', description: 'Referee end'}] : [];
  if (knownLine && ends[1]) start.push({point: ends[1], name: 'Start B', description: course.startBearing ? 'Estimated buoy position from bearing and length' : 'Buoy end'});
  const route = knownLine ? [{point: midpoint(ends[0], ends[1]), name: 'Start midpoint', description: course.startBearing ? 'Estimated start-line midpoint' : 'Start-line midpoint'}, ...marks] : marks;
  const pointXml = (tag: string, entry: {point: CoursePoint; name: string; description: string}) => `  <${tag} lat="${entry.point.latitude.toFixed(8)}" lon="${entry.point.longitude.toFixed(8)}"><name>${xml(entry.name)}</name><desc>${xml(entry.description)}</desc></${tag}>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Veetr" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${xml(name)}</name><desc>${xml(course.notes ?? '')}</desc></metadata>\n${[...start, ...marks].map(p => pointXml('wpt', p)).join('\n')}\n${route.length ? `  <rte><name>${xml(name)}</name><desc>Course order; rounding instructions are in point descriptions.</desc>\n${route.map(p => pointXml('rtept',p)).join('\n')}\n  </rte>\n` : ''}</gpx>\n`;
}
export function downloadCourseGpx(course: RaceCourse, name: string) {
  const url = URL.createObjectURL(new Blob([courseGpx(course, name)], {type: 'application/gpx+xml;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0,80) || 'race-course'}.gpx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
