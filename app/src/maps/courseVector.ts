import { boatBearings, type BoatReading } from './boatSymbol';
export const KNOTS_PER_MPS = 1.94384449;
export const angleDifference = (a: number, b: number) => ((a - b + 540) % 360) - 180;
export function movingCourse(p: BoatReading): number | null {
  return typeof p.cogDeg === 'number' && Number.isFinite(p.cogDeg) && p.cogDeg >= 0 && p.cogDeg < 360 &&
    typeof p.sogMps === 'number' && Number.isFinite(p.sogMps) && p.sogMps * KNOTS_PER_MPS > 1 ? p.cogDeg : null;
}
export function distinctCourse(p: BoatReading): number | null {
  const course = movingCourse(p), b = boatBearings(p);
  // Three degrees avoids drawing nearly coincident lines that flicker with GPS noise.
  return course !== null && !b.courseOnly && b.direction !== null && Math.abs(angleDifference(course, b.direction)) > 3 ? course : null;
}
export function courseUpBearing(previous: number | null, p: BoatReading): number {
  const course = movingCourse(p);
  return course ?? previous ?? 0; // Hold the last orientation while stopped; never chase low-speed GPS noise.
}
