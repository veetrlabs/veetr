import { receiveVaneDiagnostic } from '../diagnostics/vane';
import { receiveNorthAlignment } from '../utils/northAlignment';
import { compassTelemetry, type CompassTelemetry } from '../utils/compassTelemetry';
import { findVane, waitForBluetooth, reconnectDelay } from '../utils/bleConnection';
import { recordBleDiagnostic, setBleAdapterState, beginBleAttempt, noteBleConnected, noteBleDisconnected, noteBleSensor, noteBleRssi, noteBleFirmware, type BleStage } from '../diagnostics/ble';
import { setDeviceRecordingSource, clearDeviceRecordingSource } from "../tracking/recordingSource";
import { recordDevicePoint } from "../tracking/service";
import { createContext, useContext, useReducer, useRef, useEffect, ReactNode, useCallback } from 'react'
import { Platform, PermissionsAndroid } from 'react-native'
import { getLatestRelease, getFirmwareAsset, downloadFirmware, compareVersions, GitHubRelease, FirmwareBoard } from '../utils/githubApi'
import { BLEFirmwareUpdater, FirmwareUpdateProgress } from '../utils/firmwareUpdater'
import { showSingleAlert } from '../utils/alertUtils'

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
    } catch (error) {
      console.error('[BLE] Native module initialization failed:', error)
      bleManagerInstance = false
    }
  }
  return bleManagerInstance
}

export interface SailingData {
  compass?: CompassTelemetry;
  recordingInstruments?: {aws:number|null;tws:number|null;awa:number|null;twa:number|null;heading:number|null}
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
  gpsValid?: boolean
  course?: number | null
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
  rssi: number | null
  rssiUpdatedAt: number | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  sailingData: SailingData
  firmwareInfo: FirmwareInfo
  lastMessageTime: number | null
  deviceName: string | null
}

type BLEAction =
  | { type: 'UPDATE_RSSI'; payload: number | null }
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
  rssi: null, rssiUpdatedAt: null,
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
    case 'UPDATE_RSSI':
      return { ...state, rssi: action.payload, rssiUpdatedAt: action.payload === null ? null : Date.now() }
    case 'CONNECT_START':
      return { ...state, isConnecting: true, error: null }
    case 'CONNECT_SUCCESS':
      return { ...state, isConnecting: false, isConnected: true, error: null }
    case 'CONNECT_ERROR':
      return { ...state, isConnecting: false, error: action.payload }
    case 'DISCONNECT':
      return {
        ...state, isConnected: false, isConnecting: false,
        error: null, lastMessageTime: null, deviceName: null, rssi: null, rssiUpdatedAt: null,
        sailingData: { ...initialState.sailingData }
      }
    case 'UPDATE_DATA':
      return { ...state, sailingData: { ...state.sailingData, ...action.payload } }
    case 'UPDATE_DEVICE_NAME':
      return { ...state, deviceName: action.payload }
    case 'UPDATE_FIRMWARE_VERSION':
      return { ...state, firmwareInfo: { ...state.firmwareInfo, currentVersion: action.payload,
        updateAvailable: !!state.firmwareInfo.latestVersion && compareVersions(action.payload, state.firmwareInfo.latestVersion) } }
    case 'SET_LATEST_VERSION':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo,
          latestVersion: action.payload,
          updateAvailable: state.firmwareInfo.currentVersion !== 'Unknown' && compareVersions(state.firmwareInfo.currentVersion, action.payload)
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
  startFirmwareUpdate: (board: FirmwareBoard) => Promise<void>
  updateRegattaLine: (line: { portLat: number; portLon: number; starboardLat: number; starboardLon: number }) => void
} | null>(null)

export function BLEProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bleReducer, initialState)
  const currentFirmwareUpdaterRef = useRef<BLEFirmwareUpdater | null>(null)
  const connectedDeviceRef = useRef<any>(null)
  const serviceUuidRef = useRef<string | null>(null)
  const sensorDataCharRef = useRef<string | null>(null)
  const commandCharRef = useRef<string | null>(null)
  const retryAttemptRef = useRef(0)
  const monitorSubRef = useRef<{remove(): void} | null>(null)
  const rssiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopMonitoring = useCallback(() => {
    if (rssiTimerRef.current) clearInterval(rssiTimerRef.current)
    rssiTimerRef.current = null
    monitorSubRef.current?.remove()
    monitorSubRef.current = null
  }, [])
  const connectionBusyRef = useRef(false)
  const connectionAbortRef = useRef<AbortController | null>(null)
  const pendingDeviceRef = useRef<any>(null)
  const reconnectRef = useRef<() => Promise<void>>(async () => {})
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

      if (receiveVaneDiagnostic(parsed)) return;
      if (receiveNorthAlignment(parsed)) return;

      if (parsed.type === 'firmware_version') {
        noteBleFirmware(parsed.version)
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
      if (['chunk_ack', 'update_ready', 'update_complete', 'restarting', 'update_stopped', 'ota_status', 'error', 'update_error', 'chunk_error'].includes(parsed.type)) {
        currentFirmwareUpdaterRef.current?.handleResponse(parsed)
        return
      }

      noteBleSensor()
      const mappedData: Partial<SailingData> = {
        compass: compassTelemetry(parsed),
        recordingInstruments: {
          aws: Number.isFinite(parsed.AWS) && parsed.AWS >= 0 && parsed.AWS <= 200 ? parsed.AWS : null,
          tws: Number.isFinite(parsed.TWS) && parsed.TWS >= 0 && parsed.TWS <= 200 ? parsed.TWS : null,
          awa: Number.isFinite(parsed.AWA) ? convertToSailingAngle(parsed.AWA) : null,
          twa: Number.isFinite(parsed.TWA) ? convertToSailingAngle(parsed.TWA) : null,
          heading: Number.isFinite(parsed.HDM) && parsed.HDM >= 0 && parsed.HDM < 360 ? parsed.HDM : null,
        },
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
        gpsValid: Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon) && Math.abs(parsed.lat) <= 90 && Math.abs(parsed.lon) <= 180 && (parsed.satellites ?? parsed.sat ?? 0) >= 3,
        course: Number.isFinite(parsed.COG) && parsed.COG >= 0 && parsed.COG < 360 ? parsed.COG : null,
        gpsSpeed: Number.isFinite(parsed.SOG) && parsed.SOG >= 0 ? parsed.SOG : NaN,
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

      void recordDevicePoint(setDeviceRecordingSource({...mappedData,windSpeed:Number.isFinite(parsed.AWS)?parsed.AWS:NaN,trueWindSpeed:Number.isFinite(parsed.TWS)?parsed.TWS:NaN})).catch(err => console.error('Failed to store reading:', err))

      dispatch({ type: 'UPDATE_LAST_MESSAGE_TIME', payload: Date.now() })
    } catch (error) {
      console.error('Error parsing BLE data:', error)
    }
  }, [])

  const connectToDevice = useCallback(async (device: any, signal: AbortSignal) => {
    let phase = 'Connecting to device'
    let diagnosticStage: BleStage = 'connect'
    const checkCancelled = () => { if (signal.aborted) throw new Error('Connection cancelled') }
    recordBleDiagnostic('connect', 'start')
    try {
      console.info('[BLE]', phase)
      pendingDeviceRef.current = device
      checkCancelled()
      const connectedDevice = await device.connect({ timeout: 15000 })
      checkCancelled()
      noteBleConnected()
      recordBleDiagnostic('connect', 'success')
      connectedDeviceRef.current = connectedDevice
      lastDeviceRef.current = device

      diagnosticStage = 'discover'
      recordBleDiagnostic('discover', 'start')
      phase = 'Discovering services and characteristics'
      console.info('[BLE]', phase)
      await connectedDevice.discoverAllServicesAndCharacteristics()
      checkCancelled()

      recordBleDiagnostic('discover', 'success')
      // CoreBluetooth negotiates MTU itself. Android exposes requestMTU.
      if (Platform.OS === 'android') {
        try {
          recordBleDiagnostic('mtu', 'start')
          await connectedDevice.requestMTU(512)
          recordBleDiagnostic('mtu', 'success')
        } catch (error) { recordBleDiagnostic('mtu', 'error', error) }
        checkCancelled()
      }

      diagnosticStage = 'services'
      recordBleDiagnostic('services', 'start')
      const services: any[] = await connectedDevice.services()
      checkCancelled()
      console.info('[BLE] Service UUIDs:', services.map(s => s.uuid))
      const service = services.find((s: any) => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase())

      if (!service) throw new Error('Veetr service not found on device')

      recordBleDiagnostic('services', 'success')
      serviceUuidRef.current = service.uuid
      diagnosticStage = 'characteristics'
      recordBleDiagnostic('characteristics', 'start')

      const characteristics: any[] = await service.characteristics()
      checkCancelled()
      console.info('[BLE] Characteristic UUIDs:', characteristics.map(c => c.uuid))
      const sensorChar = characteristics.find((c: any) => c.uuid.toLowerCase() === SENSOR_DATA_CHAR_UUID.toLowerCase())
      const cmdChar = characteristics.find((c: any) => c.uuid.toLowerCase() === COMMAND_CHAR_UUID.toLowerCase())

      if (!sensorChar || !cmdChar) throw new Error('Required BLE characteristics not found')

      sensorDataCharRef.current = sensorChar.uuid
      commandCharRef.current = cmdChar.uuid

      recordBleDiagnostic('characteristics', 'success')
      diagnosticStage = 'subscribe'
      recordBleDiagnostic('subscribe', 'start')
      // Monitor sensor data
      monitorSubRef.current = connectedDevice.monitorCharacteristicForService(
        service.uuid,
        sensorChar.uuid,
        (error: any, char: any) => {
          if (signal.aborted || connectedDeviceRef.current !== connectedDevice) return
          if (error) {
            recordBleDiagnostic('subscribe', 'error', error)
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
      disconnectedSubRef.current?.()
      const sub = connectedDevice.onDisconnected((error: unknown) => {
        if (signal.aborted || connectedDeviceRef.current !== connectedDevice) return
        recordBleDiagnostic('disconnect', 'error', error)
        clearDeviceRecordingSource(); dispatch({ type: 'DISCONNECT' })
        connectedDeviceRef.current = null
        stopMonitoring()
        noteBleDisconnected()
        sensorDataCharRef.current = null
        commandCharRef.current = null

        // Auto-reconnect if not intentional
        if (!intentionalDisconnectRef.current && lastDeviceRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            recordBleDiagnostic('reconnect', 'start')
            void reconnectRef.current()
          }, 3000)
        }
      })
      disconnectedSubRef.current = () => sub.remove()

      console.info('[BLE] Connected; sensor notifications registered')
      recordBleDiagnostic('connected', 'success')
      retryAttemptRef.current = 0
      dispatch({ type: 'CONNECT_SUCCESS' })
      let readingRssi = false
      const pollRssi = async () => {
        if (readingRssi || signal.aborted || connectedDeviceRef.current !== connectedDevice) return
        readingRssi = true
        try {
          const reading = await connectedDevice.readRSSI()
          if (!signal.aborted && connectedDeviceRef.current === connectedDevice) {
            noteBleRssi(reading.rssi)
            const value = reading.rssi
            dispatch({ type: 'UPDATE_RSSI', payload: typeof value === 'number' && Number.isInteger(value) && value >= -127 && value < 0 ? value : null })
          }
        } catch { /* RSSI failure must not interrupt the connection. */ }
        finally { readingRssi = false }
      }
      void pollRssi()
      rssiTimerRef.current = setInterval(() => { void pollRssi() }, 30000)

      // Request firmware version after connection
      setTimeout(async () => {
        try {
          if (signal.aborted || connectedDeviceRef.current !== connectedDevice) return
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
      recordBleDiagnostic(diagnosticStage, 'error', error)
      console.error('[BLE]', phase, error)
      connectedDeviceRef.current = null
      stopMonitoring()
      noteBleDisconnected()
      serviceUuidRef.current = null
      sensorDataCharRef.current = null
      commandCharRef.current = null
      await device.cancelConnection().catch(() => {})
      if (!signal.aborted) dispatch({ type: 'CONNECT_ERROR', payload: `${phase}: ${errorMessage}` })
    }
  }, [handleSensorData, stopMonitoring])

  const connect = useCallback(async (automatic = false) => {
    if (connectionBusyRef.current || connectedDeviceRef.current) return
    connectionBusyRef.current = true
    const controller = new AbortController()
    connectionAbortRef.current = controller
    let diagnosticStage: BleStage = 'permission'
    dispatch({ type: 'CONNECT_START' })
    try {
      intentionalDisconnectRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
      recordBleDiagnostic('permission', 'start')
      const bleManager = getBleManager()
      if (!bleManager) throw new Error('Bluetooth is unavailable in this build.')
      const granted = await requestBLEPermissions()
      if (controller.signal.aborted) return
      recordBleDiagnostic('permission', granted ? 'success' : 'error')
      if (!granted) throw new Error('Bluetooth permissions denied')
      const knownDevice = lastDeviceRef.current
      const attempt = automatic ? ++retryAttemptRef.current : 0
      const direct = !!knownDevice && (!automatic || attempt % 3 !== 0)
      beginBleAttempt(attempt, direct ? 'direct' : 'scan')
      diagnosticStage = 'adapter'
      const onAdapterState = (adapterState: string) => {
        setBleAdapterState(adapterState)
        recordBleDiagnostic('adapter', adapterState === 'PoweredOn' ? 'success' : 'start')
      }
      let device = knownDevice
      if (direct) {
        await waitForBluetooth(bleManager, controller.signal, onAdapterState)
      } else {
        diagnosticStage = 'scan'
        recordBleDiagnostic('scan', 'start')
        device = await findVane(bleManager, controller.signal, onAdapterState, knownDevice?.id)
        recordBleDiagnostic('scan', 'success')
      }
      if (controller.signal.aborted) return
      await connectToDevice(device, controller.signal)
    } catch (error) {
      if (!controller.signal.aborted) {
        recordBleDiagnostic(diagnosticStage, 'error', error)
        dispatch({ type: 'CONNECT_ERROR', payload: error instanceof Error ? error.message : 'Bluetooth connection failed. Please try again.' })
      }
    } finally {
      pendingDeviceRef.current = null
      connectionBusyRef.current = false
      if (!controller.signal.aborted && !intentionalDisconnectRef.current && lastDeviceRef.current && !connectedDeviceRef.current) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          recordBleDiagnostic('reconnect', 'start')
          void reconnectRef.current()
        }, reconnectDelay(retryAttemptRef.current))
      }
    }
  }, [connectToDevice])
  reconnectRef.current = () => connect(true)

  const disconnect = useCallback(() => {
    recordBleDiagnostic('disconnect', 'requested')
    intentionalDisconnectRef.current = true
    connectionAbortRef.current?.abort()
    if (pendingDeviceRef.current) void pendingDeviceRef.current.cancelConnection().catch(() => {})
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
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
    retryAttemptRef.current = 0
    stopMonitoring()
    noteBleDisconnected()
    clearDeviceRecordingSource(); dispatch({ type: 'DISCONNECT' })
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

  const startFirmwareUpdate = useCallback(async (board: FirmwareBoard) => {
    if (!state.firmwareInfo.latestVersion) throw new Error('No update available')
    try {
      dispatch({ type: 'START_FIRMWARE_UPDATE' })
      const release = latestReleaseRef.current || await getLatestRelease()
      if (!release) throw new Error('Could not fetch latest release')
      const firmwareAsset = await getFirmwareAsset(release, board)
      if (!firmwareAsset) throw new Error('No firmware found')
      const firmwareData = await downloadFirmware(firmwareAsset)

      const device = connectedDeviceRef.current
      const service = serviceUuidRef.current
      const characteristic = commandCharRef.current
      if (!device || !service || !characteristic) throw new Error("Bluetooth disconnected")
      // Returns current negotiated MTU on iOS; requests a larger MTU on Android.
      const negotiated = await device.requestMTU(512)
      const maxWriteBytes = Math.min(512, negotiated.mtu - 3)
      if (!Number.isFinite(maxWriteBytes) || maxWriteBytes < 1) throw new Error("Could not determine Bluetooth packet size")
      const updater = new BLEFirmwareUpdater(
        async (_index: number, data: string) => {
          if (connectedDeviceRef.current?.id !== device.id) throw new Error("Bluetooth disconnected")
          // Match the PWA: write commands without ATT responses, then wait for
          // the firmware notification before sending the next command.
          await device.writeCharacteristicWithoutResponseForService(service, characteristic, btoa(data))
        },
        (progress) => dispatch({ type: 'UPDATE_FIRMWARE_PROGRESS', payload: progress }),
        maxWriteBytes
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
      recordBleDiagnostic('cleanup', 'requested')
      stopMonitoring()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      intentionalDisconnectRef.current = true
      connectionAbortRef.current?.abort()
      if (pendingDeviceRef.current) void pendingDeviceRef.current.cancelConnection().catch(() => {})
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
