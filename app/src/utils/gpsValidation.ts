export function isValidCoordinates(lat: number | null | undefined, lon: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return false
  if (lat === 0 && lon === 0) return false
  if (lat < -90 || lat > 90) return false
  if (lon < -180 || lon > 180) return false
  return true
}

export function hasValidGPSFix(gpsSatellites: number, lat: number, lon: number): boolean {
  if (gpsSatellites <= 0) return false
  if (!isValidCoordinates(lat, lon)) return false
  return true
}

export function hasGPSCoordinates(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return isValidCoordinates(lat, lon)
}
