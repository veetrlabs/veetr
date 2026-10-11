import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import BluetoothDetails from '../BluetoothDetails';
import BluetoothSignal from '../BluetoothSignal';
let mockState: any;
jest.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'View', StyleSheet: { flatten: (s: unknown) => s } }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'View', Path: 'View', Rect: 'View' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../context/BLEContext', () => ({ useBLE: () => ({ state: mockState }) }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  mockState = { isConnected: true, deviceName: 'Veetr Vane', rssi: -64, rssiUpdatedAt: Date.now(), lastMessageTime: Date.now(), connectionDetails: { deviceId: 'device-123', connectedAt: Date.now(), mtu: 185 } };
});
afterEach(() => jest.useRealTimers());
test('signal opens Bluetooth settings even while disconnected', () => {
  mockState.isConnected = false;
  const ui = render(<BluetoothSignal />);
  fireEvent.press(ui.getByRole('button'));
  expect(router.push).toHaveBeenCalledWith('/bluetooth-settings');
  ui.unmount();
});
test('shows live connection details and expires stale signal readings', () => {
  const ui = render(<BluetoothDetails />);
  expect(ui.getByText('-64 dBm · Strong')).toBeTruthy();
  expect(ui.getByText('device-123')).toBeTruthy();
  expect(ui.getByText('185 bytes')).toBeTruthy();
  act(() => jest.advanceTimersByTime(66000));
  expect(ui.getByText('Signal unavailable')).toBeTruthy();
  expect(ui.queryByText('-64 dBm · Strong')).toBeNull();
  mockState = { ...mockState, isConnected: false };
  ui.rerender(<BluetoothDetails />);
  expect(ui.queryByText('device-123')).toBeNull();
  expect(ui.queryByText('Veetr Vane')).toBeNull();
  ui.unmount();
});
