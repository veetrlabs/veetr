import geomagnetism from "geomagnetism";
import type { CoursePoint } from "./course";

/** WMM runs locally: no location is sent to an external service. Sea-level model for race courses. */
export function magneticCorrection(point: CoursePoint | undefined, date = new Date()): number | null {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
      Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 || !Number.isFinite(date.getTime())) return null;
  try {
    const field = geomagnetism.model(date).point([point.latitude, point.longitude, 0]);
    // Declination cannot provide a dependable heading in the magnetic blackout zone.
    return Number.isFinite(field.decl) && field.h >= 2000 ? field.decl : null;
  } catch {
    // Do not silently extrapolate an expired model or assume zero correction.
    return null;
  }
}
