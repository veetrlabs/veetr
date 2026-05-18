export interface SailingData {
  speed: number
  speedMax: number
  speedAvg: number
  windSpeed: number
  windSpeedMax: number
  windSpeedAvg: number
  windAngle: number
  windDirection: number
  trueWindSpeed: number
  trueWindSpeedMax: number
  trueWindSpeedAvg: number
  trueWindAngle: number
  tilt: number
  tiltPortMax: number
  tiltStarboardMax: number
  deadWindAngle: number
  gpsSpeed: number
  gpsSatellites: number
  hdop: number
  lat: number
  lon: number
  heading: number
  hasStartLine: boolean
  distanceToLine: number | null
  portLat: number | null
  portLon: number | null
  starboardLat: number | null
  starboardLon: number | null
}

export interface FirmwareInfo {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  updateProgress: number | null
  isUpdating: boolean
  elapsedTimeMs?: number
  estimatedTotalTimeMs?: number
  estimatedRemainingTimeMs?: number
}

export interface SensorReading {
  timestamp: number
  AWS: number
  AWA: number
  SOG: number
  HDM: number
  heel: number
  pitch: number
  lat?: number
  lon?: number
  satellites?: number
}

export interface AveragedReading extends SensorReading {
  id?: number
  sampleCount: number
}

export interface FirmwareUpdateProgress {
  percentage: number
  bytesTransferred: number
  totalBytes: number
  stage: 'preparing' | 'transferring' | 'verifying' | 'complete' | 'error'
  message: string
  elapsedTimeMs?: number
  estimatedTotalTimeMs?: number
  estimatedRemainingTimeMs?: number
}

export type FirmwareUpdateCallback = (progress: FirmwareUpdateProgress) => void

export interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: Array<{
    name: string
    download_url: string
    browser_download_url: string
    size: number
  }>
}

export interface FirmwareAsset {
  version: string
  downloadUrl: string
  size: number
  filename: string
}

export interface BleConfig {
  serviceUuid: string
  sensorDataUuid: string
  commandUuid: string
  deviceName: string
}
