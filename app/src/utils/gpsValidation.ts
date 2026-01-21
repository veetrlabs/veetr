// GPS validation utilities

import { SailingData } from '../context/BLEContext'

/**
 * Validates if GPS coordinates are within valid ranges
 * Latitude: -90 to +90 degrees
 * Longitude: -180 to +180 degrees
 */
export function isValidCoordinates(lat: number | null | undefined, lon: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return false
  }
  
  // Check if coordinates are non-zero (0,0 is typically invalid/uninitialized)
  if (lat === 0 && lon === 0) {
    return false
  }
  
  // Validate latitude range: -90 to +90
  if (lat < -90 || lat > 90) {
    return false
  }
  
  // Validate longitude range: -180 to +180
  if (lon < -180 || lon > 180) {
    return false
  }
  
  return true
}

/**
 * Checks if GPS has a valid fix based on sailing data
 * Requires: valid satellites, valid coordinates, and optionally good HDOP
 */
export function hasValidGPSFix(sailingData: SailingData): boolean {
  // Check if we have satellite lock
  if (sailingData.gpsSatellites <= 0) {
    return false
  }
  
  // Check if coordinates are valid
  if (!isValidCoordinates(sailingData.lat, sailingData.lon)) {
    return false
  }
  
  return true
}

/**
 * Simple check for valid GPS coordinates (less strict, doesn't check satellites)
 * Useful for checking if data exists (e.g., from database or BLE state)
 */
export function hasGPSCoordinates(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return isValidCoordinates(lat, lon)
}
