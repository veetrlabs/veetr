import React from 'react'
const TestRenderer = require('react-test-renderer')
const { act } = TestRenderer
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePhoneStartLine } from '../usePhoneStartLine'
import { shouldUseDeviceStartLine } from '../phoneStartLine'
import { startLineDistanceAtPosition } from '../startLineDistance'
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }))
const mark = { latitude: 43, longitude: 15, accuracyM: 5, capturedAt: '2026-09-30T10:00:00Z' }
const saved = { port: mark, starboard: { ...mark, longitude: 15.01 } }
let result: ReturnType<typeof usePhoneStartLine>
function Harness() { result = usePhoneStartLine(); return null }
beforeEach(() => { jest.clearAllMocks(); (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined) })

test('saved line remains authoritative after connecting, reconnecting and restarting', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(saved))
  let tree: { unmount(): void }
  await act(async () => { tree = TestRenderer.create(<Harness />) })
  for (const connected of [false, true, false, true]) {
    expect(shouldUseDeviceStartLine(connected, result)).toBe(false)
    expect(result.line).toEqual(saved)
  }
  expect(startLineDistanceAtPosition(result.line, { latitude: 43, longitude: 15.005 })).toBeCloseTo(0)
  await act(async () => { tree!.unmount() })
})

test('clearing both ends does not resurrect Vane marks, including after reload', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(saved))
  let tree: { unmount(): void }
  await act(async () => { tree = TestRenderer.create(<Harness />) })
  await act(async () => { await result.saveMark('port', null); await result.saveMark('starboard', null) })
  expect(shouldUseDeviceStartLine(true, result)).toBe(false)
  const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]
  await act(async () => { tree!.unmount() })
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(raw)
  await act(async () => { tree = TestRenderer.create(<Harness />) })
  expect(result.line).toEqual({ port: null, starboard: null })
  expect(shouldUseDeviceStartLine(true, result)).toBe(false)
  await act(async () => { tree!.unmount() })
})

test('Vane line is available only after storage confirms there is no phone line', async () => {
  expect(shouldUseDeviceStartLine(true, { loaded: false, hasSavedLine: false })).toBe(false)
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
  let tree: { unmount(): void }
  await act(async () => { tree = TestRenderer.create(<Harness />) })
  expect(shouldUseDeviceStartLine(true, result)).toBe(true)
  await act(async () => { await result.saveMark('port', mark) })
  expect(shouldUseDeviceStartLine(true, result)).toBe(false)
  await act(async () => { tree!.unmount() })
})
