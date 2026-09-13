import { createContext, useContext, useReducer, useRef, useEffect, ReactNode, useCallback } from 'react'
import { Platform, PermissionsAndroid } from 'react-native'
import { getLatestRelease, getFirmwareAsset, downloadFirmware, compareVersions, GitHubRelease } from '../utils/githubApi'
import { BLEFirmwareUpdater, FirmwareUpdateProgress } from '../utils/firmwareUpdater'
import { showSingleAlert } from '../utils/alertUtils'
import { dataStorage } from '../utils/dataStorage'

const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc'
const SENSOR_DATA_CHAR_UUID = '87654321-4321-4321-4321-cba987654321'
const COMMAND_CHAR_UUID = '11111111-2222-3333-4444-555555555555'
const DEVICE_NAME_PREFIX = 'Veetr'

let bleManagerInstance: any | false | null = null

function getBleManager(): any | false {
  if (bleManagerInstance === null) {
    try {
      const BLE = require('react-native-ble-plx')
      bleManagerInstance = new BLE.BleManager()
    } catch {
      bleManagerInstance = false
    }
  }
  return bleManagerInstance
}

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

interface SensorReading {
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

export interface BLEState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  sailingData: SailingData
  firmwareInfo: FirmwareInfo
  lastMessageTime: number | null
  deviceName: string | null
}

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

async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ])
    return Object.values(granted).every(r => r === PermissionsAndroid.RESULTS.GRANTED)
  } catch {
    return false
  }
}

function convertToSailingAngle(windAngle360: number): number {
  let angle = windAngle360 % 360
  if (angle < 0) angle += 360
  return angle <= 180 ? angle : angle - 360
}

const initialState: BLEState = {
  isConnected: false,
  isConnecting: false,
  error: null,
  lastMessageTime: null,
  deviceName: null,
  sailingData: {
    speed: 0, speedMax: 0, speedAvg: 0,
    windSpeed: 0, windSpeedMax: 0, windSpeedAvg: 0,
    windAngle: 0, windDirection: 0,
    trueWindSpeed: 0, trueWindSpeedMax: 0, trueWindSpeedAvg: 0,
    trueWindAngle: 0, tilt: 0, tiltPortMax: 0, tiltStarboardMax: 0,
    deadWindAngle: 40, gpsSpeed: 0, gpsSatellites: 0, hdop: 0,
    lat: 0, lon: 0, heading: 0,
    hasStartLine: false, distanceToLine: null,
    portLat: null, portLon: null, starboardLat: null, starboardLon: null
  },
  firmwareInfo: {
    currentVersion: 'Unknown', latestVersion: null,
    updateAvailable: false, updateProgress: null, isUpdating: false
  }
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
        sailingData: { ...initialState.sailingData }
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
          updateAvailable: action.payload !== state.firmwareInfo.currentVersion
        }
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
          estimatedRemainingTimeMs: action.payload.estimatedRemainingTimeMs
        }
      }
    case 'FIRMWARE_UPDATE_COMPLETE':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo, isUpdating: false, updateProgress: null, updateAvailable: false,
          currentVersion: state.firmwareInfo.latestVersion || state.firmwareInfo.currentVersion
        }
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
          hasStartLine: !!(action.payload.portLat && action.payload.portLon && action.payload.starboardLat && action.payload.starboardLon)
        }
      }
    case 'UPDATE_LAST_MESSAGE_TIME':
      return { ...state, lastMessageTime: action.payload }
    default:
      return state
  }
}

const BLEContext = createContext<{
  state: BLEState
  connect: () => Promise<void>
  disconnect: () => void
  sendCommand: (command: any) => Promise<boolean>
  checkForUpdates: () => Promise<void>
  startFirmwareUpdate: () => Promise<void>
  updateRegattaLine: (line: { portLat: number; portLon: number; starboardLat: number; starboardLon: number }) => void
} | null>(null)

export function BLEProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bleReducer, initialState)
  const currentFirmwareUpdaterRef = useRef<BLEFirmwareUpdater | null>(null)
  const connectedDeviceRef = useRef<any>(null)
  const serviceUuidRef = useRef<string | null>(null)
  const sensorDataCharRef = useRef<string | null>(null)
  const commandCharRef = useRef<string | null>(null)
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disconnectedSubRef = useRef<(() => void) | null>(null)
  const latestReleaseRef = useRef<GitHubRelease | null>(null)
  const lastDeviceRef = useRef<any>(null)
  const intentionalDisconnectRef = useRef(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSensorData = useCallback((data: any) => {
    try {
      if (!data?.value) return
      const value = atob(data.value)
      if (!value || value.length < 2 || !value.startsWith('{')) return

      let parsed
      try { parsed = JSON.parse(value) } catch {
        console.warn('[BLE] Failed to parse sensor data:', value.slice(0, 100))
        return
      }

      if (parsed.type === 'firmware_version') {
        dispatch({ type: 'UPDATE_FIRMWARE_VERSION', payload: parsed.version })
        return
      }
      if (parsed.type === 'device_name') {
        dispatch({ type: 'UPDATE_DEVICE_NAME', payload: parsed.deviceName })
        return
      }
      if (parsed.type === 'regatta_coords' || parsed.type === 'regatta_line') {
        dispatch({ type: 'UPDATE_DATA', payload: { portLat: parsed.portLat || null, portLon: parsed.portLon || null, starboardLat: parsed.starboardLat || null, starboardLon: parsed.starboardLon || null } })
        return
      }
      if (parsed.type === 'chunk_ack') {
        if (currentFirmwareUpdaterRef.current) currentFirmwareUpdaterRef.current.handleChunkAck(parsed)
        return
      }
      if (parsed.type === 'update_error' || parsed.type === 'chunk_error') {
        if (currentFirmwareUpdaterRef.current) { currentFirmwareUpdaterRef.current.abort(); currentFirmwareUpdaterRef.current = null }
        return
      }

      const mappedData: Partial<SailingData> = {
        speed: parsed.SOG || 0,
        speedMax: parsed.SOGMax || 0,
        speedAvg: parsed.SOGAvg || 0,
        windSpeed: parsed.AWS || 0,
        windSpeedMax: parsed.AWSMax || 0,
        windSpeedAvg: parsed.AWSAvg || 0,
        windAngle: convertToSailingAngle(parsed.AWA || 0),
        trueWindSpeed: parsed.TWS || 0,
        trueWindSpeedMax: parsed.TWSMax || 0,
        trueWindSpeedAvg: parsed.TWSAvg || 0,
        trueWindAngle: convertToSailingAngle(parsed.TWA || 0),
        tilt: parsed.heel ?? parsed.hl ?? 0,
        tiltPortMax: parsed.heelPortMax || 0,
        tiltStarboardMax: parsed.heelStarboardMax || 0,
        deadWindAngle: parsed.deadWind || 40,
        gpsSpeed: parsed.SOG || 0,
        gpsSatellites: parsed.satellites ?? parsed.sat ?? 0,
        hdop: parsed.hdop || 0,
        lat: parsed.lat || 0,
        lon: parsed.lon || 0,
        heading: parsed.HDM || 0,
        hasStartLine: parsed.ln !== undefined,
        distanceToLine: parsed.ln ?? null,
      }
      mappedData.windDirection = mappedData.windAngle

      dispatch({ type: 'UPDATE_DATA', payload: mappedData })

      dataStorage.addReading({
        timestamp: Date.now(),
        AWS: mappedData.windSpeed || 0,
        AWA: parsed.AWA || 0,
        SOG: mappedData.speed || 0,
        HDM: mappedData.heading || 0,
        heel: mappedData.tilt || 0,
        pitch: parsed.pitch || 0,
        lat: mappedData.lat && mappedData.lat !== 0 ? mappedData.lat : undefined,
        lon: mappedData.lon && mappedData.lon !== 0 ? mappedData.lon : undefined,
        satellites: mappedData.gpsSatellites,
      }).catch(err => console.error('Failed to store reading:', err))

      dispatch({ type: 'UPDATE_LAST_MESSAGE_TIME', payload: Date.now() })
    } catch (error) {
      console.error('Error parsing BLE data:', error)
    }
  }, [])

  const connectToDevice = useCallback(async (device: any) => {
    try {
      const connectedDevice = await device.connect()
      connectedDeviceRef.current = connectedDevice
      lastDeviceRef.current = device

      await connectedDevice.discoverAllServicesAndCharacteristics()

      try {
        await connectedDevice.negotiateMtu(512)
      } catch (e) {
        console.warn('[BLE] MTU negotiation failed:', e)
      }

      const services: any[] = await connectedDevice.services()
      const service = services.find((s: any) => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase())

      if (!service) throw new Error('Veetr service not found on device')

      serviceUuidRef.current = service.uuid

      const characteristics: any[] = await service.characteristics()
      const sensorChar = characteristics.find((c: any) => c.uuid.toLowerCase() === SENSOR_DATA_CHAR_UUID.toLowerCase())
      const cmdChar = characteristics.find((c: any) => c.uuid.toLowerCase() === COMMAND_CHAR_UUID.toLowerCase())

      if (!sensorChar || !cmdChar) throw new Error('Required BLE characteristics not found')

      sensorDataCharRef.current = sensorChar.uuid
      commandCharRef.current = cmdChar.uuid

      // Monitor sensor data
      connectedDevice.monitorCharacteristicForService(
        service.uuid,
        sensorChar.uuid,
        (error: any, char: any) => {
          if (error) {
            console.error('[BLE] Monitor error:', error.message)
            return
          }
          if (char) handleSensorData(char)
        }
      )

      if (connectedDevice.name) {
        dispatch({ type: 'UPDATE_DEVICE_NAME', payload: connectedDevice.name })
      }

      // Store subscription for cleanup
      const sub = connectedDevice.onDisconnected(() => {
        dispatch({ type: 'DISCONNECT' })
        connectedDeviceRef.current = null
        sensorDataCharRef.current = null
        commandCharRef.current = null

        // Auto-reconnect if not intentional
        if (!intentionalDisconnectRef.current && lastDeviceRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            connectToDevice(lastDeviceRef.current)
          }, 3000)
        }
      })
      disconnectedSubRef.current = () => sub.remove()

      dispatch({ type: 'CONNECT_SUCCESS' })

      // Request firmware version after connection
      setTimeout(async () => {
        try {
          const cmd = JSON.stringify({ cmd: 'GET_FW_VERSION' })
          await connectedDevice.writeCharacteristicWithResponseForService(
            service.uuid, cmdChar.uuid, btoa(cmd)
          )
          const regattaCmd = JSON.stringify({ cmd: 'GET_REGATTA_LINE' })
          await connectedDevice.writeCharacteristicWithResponseForService(
            service.uuid, cmdChar.uuid, btoa(regattaCmd)
          )
        } catch (e) {
          console.error('Failed to request firmware version:', e)
        }
      }, 2000)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      dispatch({ type: 'CONNECT_ERROR', payload: errorMessage })
    }
  }, [handleSensorData])

  const connect = useCallback(async () => {
    try {
      const bleManager = getBleManager()

      dispatch({ type: 'CONNECT_START' })

      if (!bleManager) {
        dispatch({ type: 'CONNECT_ERROR', payload: 'BLE requires a development build. Use `npx expo run:ios` or EAS Build.' })
        return
      }

      const permissionsGranted = await requestBLEPermissions()
      if (!permissionsGranted) {
        dispatch({ type: 'CONNECT_ERROR', payload: 'Bluetooth permissions denied' })
        return
      }

      intentionalDisconnectRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      let found = false
      bleManager.startDeviceScan(null, null, (error: any, scannedDevice: any) => {
        if (error) {
          dispatch({ type: 'CONNECT_ERROR', payload: error.message })
          return
        }
        if (!found && scannedDevice && scannedDevice.name?.includes(DEVICE_NAME_PREFIX)) {
          found = true
          bleManager.stopDeviceScan()
          if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current)
            scanTimeoutRef.current = null
          }
          connectToDevice(scannedDevice)
        }
      })

      scanTimeoutRef.current = setTimeout(() => {
        if (!found) {
          bleManager.stopDeviceScan()
          dispatch({ type: 'CONNECT_ERROR', payload: 'No Veetr device found. Ensure the device is powered on and nearby.' })
        }
        scanTimeoutRef.current = null
      }, 30000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      dispatch({ type: 'CONNECT_ERROR', payload: errorMessage })
    }
  }, [connectToDevice])

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }
    if (disconnectedSubRef.current) {
      disconnectedSubRef.current()
      disconnectedSubRef.current = null
    }
    if (connectedDeviceRef.current) {
      connectedDeviceRef.current.cancelConnection()
      connectedDeviceRef.current = null
    }
    sensorDataCharRef.current = null
    commandCharRef.current = null
    serviceUuidRef.current = null
    lastDeviceRef.current = null
    dispatch({ type: 'DISCONNECT' })
  }, [])

  const sendCommand = useCallback(async (command: any): Promise<boolean> => {
    const device = connectedDeviceRef.current
    const cmdCharUuid = commandCharRef.current
    const svcUuid = serviceUuidRef.current
    if (!device || !cmdCharUuid || !svcUuid) {
      console.error('BLE not connected')
      return false
    }

    try {
      const cmdStr = typeof command === 'string' ? command : JSON.stringify(command)
      await device.writeCharacteristicWithResponseForService(
        svcUuid, cmdCharUuid, btoa(cmdStr)
      )
      return true
    } catch (error) {
      console.error('Error sending BLE command:', error)
      return false
    }
  }, [])

  const checkForUpdates = useCallback(async () => {
    try {
      latestReleaseRef.current = await getLatestRelease()
      const release = latestReleaseRef.current
      if (!release) return
      dispatch({ type: 'SET_LATEST_VERSION', payload: release.tag_name })
      if (state.firmwareInfo.currentVersion === 'Unknown') return
      if (!compareVersions(state.firmwareInfo.currentVersion, release.tag_name)) return
    } catch (error) {
      console.error('Failed to check for updates:', error)
    }
  }, [state.firmwareInfo.currentVersion])

  const startFirmwareUpdate = useCallback(async () => {
    if (!state.firmwareInfo.latestVersion) throw new Error('No update available')
    try {
      dispatch({ type: 'START_FIRMWARE_UPDATE' })
      const release = latestReleaseRef.current || await getLatestRelease()
      if (!release) throw new Error('Could not fetch latest release')
      const firmwareAsset = await getFirmwareAsset(release)
      if (!firmwareAsset) throw new Error('No firmware found')
      const firmwareData = await downloadFirmware(firmwareAsset)

      const updater = new BLEFirmwareUpdater(
        async (_index: number, data: string) => {
          await sendCommand(data)
        },
        (progress) => dispatch({ type: 'UPDATE_FIRMWARE_PROGRESS', payload: progress })
      )
      currentFirmwareUpdaterRef.current = updater
      await updater.updateFirmware(firmwareData)
      currentFirmwareUpdaterRef.current = null
      dispatch({ type: 'FIRMWARE_UPDATE_COMPLETE' })
    } catch (error) {
      if (currentFirmwareUpdaterRef.current) {
        currentFirmwareUpdaterRef.current.abort()
        currentFirmwareUpdaterRef.current = null
      }
      dispatch({ type: 'FIRMWARE_UPDATE_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }, [state.firmwareInfo.latestVersion, sendCommand])

  const updateRegattaLine = useCallback((line: { portLat: number; portLon: number; starboardLat: number; starboardLon: number }) => {
    dispatch({ type: 'UPDATE_REGATTA_LINE', payload: line })
  }, [])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
      if (disconnectedSubRef.current) {
        disconnectedSubRef.current()
        disconnectedSubRef.current = null
      }
      const bleManager = getBleManager()
      if (bleManager) bleManager.stopDeviceScan()
      if (connectedDeviceRef.current) {
        connectedDeviceRef.current.cancelConnection()
        connectedDeviceRef.current = null
      }
    }
  }, [])

  return (
    <BLEContext.Provider value={{
      state, connect, disconnect, sendCommand,
      checkForUpdates, startFirmwareUpdate, updateRegattaLine
    }}>
      {children}
    </BLEContext.Provider>
  )
}

export function useBLE() {
  const context = useContext(BLEContext)
  if (!context) throw new Error('useBLE must be used within a BLEProvider')
  return context
}
