import { bleDiagnostics, clearBleDiagnostics } from '../../diagnostics/ble'
import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { BLEProvider, useBLE } from '../BLEContext'

const mockManager = {
  state: jest.fn().mockResolvedValue('PoweredOn'),
  onStateChange: jest.fn(callback => { callback('PoweredOn'); return {remove: jest.fn()}; }),
  startDeviceScan: jest.fn(),
  stopDeviceScan: jest.fn().mockResolvedValue(undefined),
}

jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn(() => mockManager) }))
jest.mock('../../tracking/recordingSource', () => ({
  setDeviceRecordingSource: jest.fn(), clearDeviceRecordingSource: jest.fn(),
}))
jest.mock('../../tracking/service', () => ({ recordDevicePoint: jest.fn() }))
jest.mock('../../utils/githubApi', () => ({}))
jest.mock('../../utils/firmwareUpdater', () => ({}))

describe('BLE connection failures', () => {
  beforeEach(() => {
    clearBleDiagnostics()
    jest.useFakeTimers()
    jest.spyOn(console, 'info').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('captures a cancelled native connection without leaking its device or message', async () => {
    const failure = Object.assign(new Error('Operation was cancelled SECRET'), {errorCode: 2, iosErrorCode: 6, deviceID: 'SECRET'});
    mockManager.startDeviceScan.mockImplementationOnce((_uuids, _options, callback) => {
      callback(null, {name: 'Veetr SECRET', id: 'SECRET', cancelConnection: jest.fn().mockResolvedValue(undefined), connect: jest.fn().mockRejectedValue(failure)});
      return Promise.resolve();
    });
    const {result, unmount} = renderHook(() => useBLE(), {wrapper: ({children}) => <BLEProvider>{children}</BLEProvider>});
    await act(async () => { await result.current.connect() });
    expect(bleDiagnostics()).toContainEqual(expect.objectContaining({stage:'scan',outcome:'success'}));
    expect(bleDiagnostics()).toContainEqual(expect.objectContaining({stage:'connect',outcome:'error',errorCode:2,iosErrorCode:6,adapterState:'PoweredOn'}));
    expect(JSON.stringify(bleDiagnostics())).not.toContain('SECRET');
    unmount();
  });

  it('ignores a failed scan callback during retry and serializes repeated taps', async () => {
    const callbacks: any[] = [];
    mockManager.startDeviceScan.mockImplementation((_u, _o, callback) => { callbacks.push(callback); return Promise.resolve(); });
    const {result, unmount} = renderHook(() => useBLE(), {wrapper: ({children}) => <BLEProvider>{children}</BLEProvider>});
    let first!: Promise<void>;
    await act(async () => { first = result.current.connect(); });
    await act(async () => { callbacks[0](new Error('scan failed'), null); await first; });
    let second!: Promise<void>;
    await act(async () => { second = result.current.connect(); await result.current.connect(); });
    expect(callbacks).toHaveLength(2);
    const device = {name:'Veetr', connect:jest.fn().mockRejectedValue(new Error('test failure')),cancelConnection:jest.fn().mockResolvedValue(undefined)};
    await act(async () => {
      callbacks[0](null, device);
      callbacks[1](null, device);
      callbacks[1](null, device);
      await second;
    });
    expect(device.connect).toHaveBeenCalledTimes(1);
    unmount();
  });

  it.each(['callback', 'promise'])('preserves a %s scan error after the scan timeout', async kind => {
    const message = 'Bluetooth is unauthorized'
    if (kind === 'callback') {
      mockManager.startDeviceScan.mockImplementationOnce((_uuids, _options, callback) => {
        callback(new Error(message), null)
        return Promise.resolve()
      })
    } else {
      mockManager.startDeviceScan.mockRejectedValueOnce(new Error(message))
    }
    const { result, unmount } = renderHook(() => useBLE(), {
      wrapper: ({ children }) => <BLEProvider>{children}</BLEProvider>,
    })

    await act(async () => { await result.current.connect() })
    expect(result.current.state.error).toBe(message)
    expect(result.current.state.isConnecting).toBe(false)
    act(() => { jest.advanceTimersByTime(31000) })
    expect(result.current.state.error).toBe(message)
    unmount()
  })
})
