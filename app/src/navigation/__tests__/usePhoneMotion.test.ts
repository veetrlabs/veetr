import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { usePhoneMotion } from '../usePhoneMotion';
import { phoneMotion } from '../phoneMotion';

jest.mock('expo-sensors', () => ({ Accelerometer: {
  isAvailableAsync: jest.fn(async () => true),
  setUpdateInterval: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
} }));

beforeEach(() => {
  jest.clearAllMocks(); phoneMotion.reset();
  Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' });
});
test('subscribes at 5 Hz and converts g to m/s²; unsubscribes on background and unmount', async () => {
  let onState: (state: string) => void = () => {};
  let state = 'active';
  const original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
  Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => state });
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, cb) => {
    onState = cb as typeof onState;
    return { remove: jest.fn() };
  });
  const spy = jest.spyOn(phoneMotion, 'add');
  const hook = renderHook(() => usePhoneMotion());
  await act(async () => {});
  expect(Accelerometer.setUpdateInterval).toHaveBeenCalledWith(200);
  const callback = jest.mocked(Accelerometer.addListener).mock.calls[0][0];
  act(() => callback({ x: 0, y: 0, z: 1, timestamp: 1 }));
  expect(spy).toHaveBeenLastCalledWith(0, 0, 9.81, expect.any(Number));
  const sub = jest.mocked(Accelerometer.addListener).mock.results[0].value;
  state = 'background';
  await act(async () => onState('background'));
  expect(sub.remove).toHaveBeenCalledTimes(1);
  expect(phoneMotion.state(Date.now())).toBe('unknown');
  hook.unmount();
  listener.mockRestore(); spy.mockRestore();
  if (original) Object.defineProperty(AppState, 'currentState', original);
});
test('an async availability check cannot subscribe after unmount', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  let resolve!: (value: boolean) => void;
  jest.mocked(Accelerometer.isAvailableAsync).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const hook = renderHook(() => usePhoneMotion());
  hook.unmount();
  await act(async () => resolve(true));
  expect(Accelerometer.addListener).not.toHaveBeenCalled();
  listener.mockRestore();
});
