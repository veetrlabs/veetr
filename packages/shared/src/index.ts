export type {
  SailingData,
  FirmwareInfo,
  SensorReading,
  AveragedReading,
  FirmwareUpdateProgress,
  FirmwareUpdateCallback,
  GitHubRelease,
  FirmwareAsset,
  BleConfig
} from './types'

export { DEFAULT_BLE_CONFIG, convertToSailingAngle, getSignalQuality } from './utils/sailing'
export { isValidCoordinates, hasValidGPSFix, hasGPSCoordinates } from './utils/gpsValidation'
export { getLatestRelease, getFirmwareAsset, compareVersions } from './utils/githubApi'
export { FIRMWARE_COMMANDS, formatTime } from './utils/firmware'
