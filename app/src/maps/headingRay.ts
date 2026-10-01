import { boatBearings, type BoatReading } from './boatSymbol';
export interface MapRegion { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }
const radians = Math.PI / 180;
const mercator = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, latitude)) * radians / 2));
/** A constant-bearing line extending beyond the viewport; the map clips it at its edge. */
export function headingRay(origin: { latitude: number; longitude: number }, reading: BoatReading, region: MapRegion) {
  const { direction } = boatBearings(reading);
  if (direction === null) return [];
  const y = mercator(origin.latitude);
  const spanY = Math.abs(mercator(region.latitude + region.latitudeDelta / 2) - mercator(region.latitude - region.latitudeDelta / 2));
  const offsetX = Math.abs(((origin.longitude - region.longitude + 540) % 360) - 180) * radians;
  const length = 2 * Math.hypot(Math.max(region.longitudeDelta * radians, .00001) + offsetX, spanY + Math.abs(y - mercator(region.latitude)));
  const bearing = direction * radians;
  const longitude = origin.longitude + Math.sin(bearing) * length / radians;
  const latitude = (2 * Math.atan(Math.exp(y + Math.cos(bearing) * length)) - Math.PI / 2) / radians;
  return [origin, { latitude: Math.max(-85, Math.min(85, latitude)), longitude: ((longitude + 540) % 360) - 180 }];
}
