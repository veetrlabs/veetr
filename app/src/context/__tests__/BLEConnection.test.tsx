import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { BLEProvider, useBLE } from '../BLEContext'

const mockManager = {
  state: jest.fn().mockResolvedValue('PoweredOn'),
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
    jest.useFakeTimers()
    jest.spyOn(console, 'info').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

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
