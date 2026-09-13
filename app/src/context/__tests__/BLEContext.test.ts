type BLEAction =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS' }
  | { type: 'CONNECT_ERROR'; payload: string }
  | { type: 'DISCONNECT' }
  | { type: 'UPDATE_DATA'; payload: Partial<SailingData> }
  | { type: 'UPDATE_DEVICE_NAME'; payload: string }
  | { type: 'UPDATE_FIRMWARE_VERSION'; payload: string }
  | { type: 'SET_LATEST_VERSION'; payload: string }
  | { type: 'START_FIRMWARE_UPDATE' }
  | { type: 'UPDATE_FIRMWARE_PROGRESS'; payload: FirmwareUpdateProgress }
  | { type: 'FIRMWARE_UPDATE_COMPLETE' }
  | { type: 'FIRMWARE_UPDATE_ERROR'; payload: string }
  | { type: 'UPDATE_REGATTA_LINE'; payload: { portLat: number; portLon: number; starboardLat: number; starboardLon: number } }
  | { type: 'UPDATE_LAST_MESSAGE_TIME'; payload: number }

interface SailingData {
  speed: number; speedMax: number; speedAvg: number
  windSpeed: number; windSpeedMax: number; windSpeedAvg: number
  windAngle: number; windDirection: number
  trueWindSpeed: number; trueWindSpeedMax: number; trueWindSpeedAvg: number
  trueWindAngle: number; tilt: number; tiltPortMax: number; tiltStarboardMax: number
  deadWindAngle: number; gpsSpeed: number; gpsSatellites: number; hdop: number
  lat: number; lon: number; heading: number
  hasStartLine: boolean; distanceToLine: number | null
  portLat: number | null; portLon: number | null; starboardLat: number | null; starboardLon: number | null
}

interface FirmwareInfo {
  currentVersion: string; latestVersion: string | null
  updateAvailable: boolean; updateProgress: number | null; isUpdating: boolean
  elapsedTimeMs?: number; estimatedTotalTimeMs?: number; estimatedRemainingTimeMs?: number
}

interface BLEState {
  isConnected: boolean; isConnecting: boolean; error: string | null
  sailingData: SailingData; firmwareInfo: FirmwareInfo
  lastMessageTime: number | null; deviceName: string | null
}

interface FirmwareUpdateProgress {
  percentage: number; bytesTransferred: number; totalBytes: number
  stage: string; message: string
  elapsedTimeMs?: number; estimatedTotalTimeMs?: number; estimatedRemainingTimeMs?: number
}

const initialState: BLEState = {
  isConnected: false, isConnecting: false, error: null, lastMessageTime: null, deviceName: null,
  sailingData: {
    speed: 0, speedMax: 0, speedAvg: 0, windSpeed: 0, windSpeedMax: 0, windSpeedAvg: 0,
    windAngle: 0, windDirection: 0, trueWindSpeed: 0, trueWindSpeedMax: 0, trueWindSpeedAvg: 0,
    trueWindAngle: 0, tilt: 0, tiltPortMax: 0, tiltStarboardMax: 0, deadWindAngle: 40,
    gpsSpeed: 0, gpsSatellites: 0, hdop: 0, lat: 0, lon: 0, heading: 0,
    hasStartLine: false, distanceToLine: null,
    portLat: null, portLon: null, starboardLat: null, starboardLon: null,
  },
  firmwareInfo: {
    currentVersion: 'Unknown', latestVersion: null,
    updateAvailable: false, updateProgress: null, isUpdating: false,
  },
}

function bleReducer(state: BLEState, action: BLEAction): BLEState {
  switch (action.type) {
    case 'CONNECT_START':
      return { ...state, isConnecting: true, error: null }
    case 'CONNECT_SUCCESS':
      return { ...state, isConnecting: false, isConnected: true, error: null }
    case 'CONNECT_ERROR':
      return { ...state, isConnecting: false, error: action.payload }
    case 'DISCONNECT':
      return {
        ...state, isConnected: false, isConnecting: false,
        error: null, lastMessageTime: null, deviceName: null,
        sailingData: { ...initialState.sailingData },
      }
    case 'UPDATE_DATA':
      return { ...state, sailingData: { ...state.sailingData, ...action.payload } }
    case 'UPDATE_DEVICE_NAME':
      return { ...state, deviceName: action.payload }
    case 'UPDATE_FIRMWARE_VERSION':
      return { ...state, firmwareInfo: { ...state.firmwareInfo, currentVersion: action.payload } }
    case 'SET_LATEST_VERSION':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo,
          latestVersion: action.payload,
          updateAvailable: action.payload !== state.firmwareInfo.currentVersion,
        },
      }
    case 'START_FIRMWARE_UPDATE':
      return { ...state, firmwareInfo: { ...state.firmwareInfo, isUpdating: true, updateProgress: 0 } }
    case 'UPDATE_FIRMWARE_PROGRESS':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo,
          updateProgress: action.payload.percentage,
          elapsedTimeMs: action.payload.elapsedTimeMs,
          estimatedTotalTimeMs: action.payload.estimatedTotalTimeMs,
          estimatedRemainingTimeMs: action.payload.estimatedRemainingTimeMs,
        },
      }
    case 'FIRMWARE_UPDATE_COMPLETE':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo, isUpdating: false, updateProgress: null, updateAvailable: false,
          currentVersion: state.firmwareInfo.latestVersion || state.firmwareInfo.currentVersion,
        },
      }
    case 'FIRMWARE_UPDATE_ERROR':
      return { ...state, firmwareInfo: { ...state.firmwareInfo, isUpdating: false, updateProgress: null }, error: action.payload }
    case 'UPDATE_REGATTA_LINE':
      return {
        ...state,
        sailingData: {
          ...state.sailingData,
          portLat: action.payload.portLat, portLon: action.payload.portLon,
          starboardLat: action.payload.starboardLat, starboardLon: action.payload.starboardLon,
          hasStartLine: !!(action.payload.portLat && action.payload.portLon && action.payload.starboardLat && action.payload.starboardLon),
        },
      }
    case 'UPDATE_LAST_MESSAGE_TIME':
      return { ...state, lastMessageTime: action.payload }
    default:
      return state
  }
}

describe('bleReducer', () => {
  it('handles CONNECT_START', () => {
    const state = bleReducer(initialState, { type: 'CONNECT_START' })
    expect(state.isConnecting).toBe(true)
    expect(state.error).toBeNull()
  })

  it('handles CONNECT_SUCCESS', () => {
    const start = bleReducer(initialState, { type: 'CONNECT_START' })
    const state = bleReducer(start, { type: 'CONNECT_SUCCESS' })
    expect(state.isConnecting).toBe(false)
    expect(state.isConnected).toBe(true)
  })

  it('handles CONNECT_ERROR', () => {
    const state = bleReducer(initialState, { type: 'CONNECT_ERROR', payload: 'Failed' })
    expect(state.isConnecting).toBe(false)
    expect(state.error).toBe('Failed')
  })

  it('handles DISCONNECT', () => {
    const connected = bleReducer(initialState, { type: 'CONNECT_SUCCESS' })
    const state = bleReducer(connected, { type: 'DISCONNECT' })
    expect(state.isConnected).toBe(false)
    expect(state.deviceName).toBeNull()
    expect(state.sailingData.speed).toBe(0)
  })

  it('handles UPDATE_DATA', () => {
    const state = bleReducer(initialState, { type: 'UPDATE_DATA', payload: { speed: 5.2, windSpeed: 12 } })
    expect(state.sailingData.speed).toBe(5.2)
    expect(state.sailingData.windSpeed).toBe(12)
    expect(state.sailingData.heading).toBe(0)
  })

  it('handles UPDATE_DEVICE_NAME', () => {
    const state = bleReducer(initialState, { type: 'UPDATE_DEVICE_NAME', payload: 'Veetr-001' })
    expect(state.deviceName).toBe('Veetr-001')
  })

  it('handles UPDATE_FIRMWARE_VERSION', () => {
    const state = bleReducer(initialState, { type: 'UPDATE_FIRMWARE_VERSION', payload: 'v1.2.0' })
    expect(state.firmwareInfo.currentVersion).toBe('v1.2.0')
  })

  it('handles SET_LATEST_VERSION with different version', () => {
    const withVersion = bleReducer(initialState, { type: 'UPDATE_FIRMWARE_VERSION', payload: 'v1.0.0' })
    const state = bleReducer(withVersion, { type: 'SET_LATEST_VERSION', payload: 'v1.1.0' })
    expect(state.firmwareInfo.latestVersion).toBe('v1.1.0')
    expect(state.firmwareInfo.updateAvailable).toBe(true)
  })

  it('handles SET_LATEST_VERSION with same version', () => {
    const withVersion = bleReducer(initialState, { type: 'UPDATE_FIRMWARE_VERSION', payload: 'v1.0.0' })
    const state = bleReducer(withVersion, { type: 'SET_LATEST_VERSION', payload: 'v1.0.0' })
    expect(state.firmwareInfo.latestVersion).toBe('v1.0.0')
    expect(state.firmwareInfo.updateAvailable).toBe(false)
  })

  it('handles START_FIRMWARE_UPDATE', () => {
    const state = bleReducer(initialState, { type: 'START_FIRMWARE_UPDATE' })
    expect(state.firmwareInfo.isUpdating).toBe(true)
    expect(state.firmwareInfo.updateProgress).toBe(0)
  })

  it('handles UPDATE_FIRMWARE_PROGRESS', () => {
    const started = bleReducer(initialState, { type: 'START_FIRMWARE_UPDATE' })
    const state = bleReducer(started, {
      type: 'UPDATE_FIRMWARE_PROGRESS',
      payload: { percentage: 50, bytesTransferred: 512, totalBytes: 1024, stage: 'transferring', message: 'uploading' },
    })
    expect(state.firmwareInfo.updateProgress).toBe(50)
  })

  it('handles FIRMWARE_UPDATE_COMPLETE', () => {
    const withLatest = bleReducer(
      { ...initialState, firmwareInfo: { ...initialState.firmwareInfo, currentVersion: 'v1.0.0', latestVersion: 'v2.0.0' } },
      { type: 'START_FIRMWARE_UPDATE' },
    )
    const state = bleReducer(withLatest, { type: 'FIRMWARE_UPDATE_COMPLETE' })
    expect(state.firmwareInfo.isUpdating).toBe(false)
    expect(state.firmwareInfo.updateAvailable).toBe(false)
    expect(state.firmwareInfo.currentVersion).toBe('v2.0.0')
  })

  it('handles FIRMWARE_UPDATE_ERROR', () => {
    const started = bleReducer(initialState, { type: 'START_FIRMWARE_UPDATE' })
    const state = bleReducer(started, { type: 'FIRMWARE_UPDATE_ERROR', payload: 'Upload failed' })
    expect(state.firmwareInfo.isUpdating).toBe(false)
    expect(state.firmwareInfo.updateProgress).toBeNull()
    expect(state.error).toBe('Upload failed')
  })

  it('handles UPDATE_REGATTA_LINE', () => {
    const state = bleReducer(initialState, {
      type: 'UPDATE_REGATTA_LINE',
      payload: { portLat: 51.5, portLon: -0.12, starboardLat: 51.6, starboardLon: -0.13 },
    })
    expect(state.sailingData.portLat).toBe(51.5)
    expect(state.sailingData.hasStartLine).toBe(true)
  })

  it('handles UPDATE_REGATTA_LINE with null values', () => {
    const state = bleReducer(initialState, {
      type: 'UPDATE_REGATTA_LINE',
      payload: { portLat: 0, portLon: 0, starboardLat: 0, starboardLon: 0 },
    })
    expect(state.sailingData.hasStartLine).toBe(false)
  })

  it('handles UPDATE_LAST_MESSAGE_TIME', () => {
    const state = bleReducer(initialState, { type: 'UPDATE_LAST_MESSAGE_TIME', payload: 1234567890 })
    expect(state.lastMessageTime).toBe(1234567890)
  })
})
