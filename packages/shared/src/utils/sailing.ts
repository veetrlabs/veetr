import { BleConfig } from '../types'

export const DEFAULT_BLE_CONFIG: BleConfig = {
  serviceUuid: '12345678-1234-1234-1234-123456789abc',
  sensorDataUuid: '87654321-4321-4321-4321-cba987654321',
  commandUuid: '11111111-2222-3333-4444-555555555555',
  deviceName: 'Veetr'
}

export function convertToSailingAngle(windAngle360: number): number {
  let angle = windAngle360 % 360
  if (angle < 0) angle += 360
  if (angle <= 180) {
    return angle
  } else {
    return angle - 360
  }
}

export function getSignalQuality(rssi: number): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' {
  if (rssi >= -50) return 'excellent'
  if (rssi >= -60) return 'good'
  if (rssi >= -70) return 'fair'
  if (rssi >= -80) return 'poor'
  return 'poor'
}
