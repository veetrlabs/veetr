import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { notifyAlarm, prepareNotifications, stopAlarmTest } from '../notifications';
import AnchorSettings from '../AnchorSettings';
import { defaults, type Coordinate, type AnchorFix } from '../model';
const mockCamera = jest.fn();
const mockEdit = jest.fn().mockResolvedValue(undefined);
const mockSnapshot = { settings: { ...defaults, anchor: null as Coordinate | null, chainM: 55, marginM: 12 },
  fix: { latitude: 43, longitude: 16, source: 'phone', accuracy: 5, timestamp: Date.now() } as AnchorFix | null, ready: true, error: '' };
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', ScrollView: 'ScrollView', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity',
  Platform: { OS: 'ios' }, Alert: { alert: jest.fn() },
  StyleSheet: { absoluteFillObject: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }, create: (s: unknown) => s, flatten: (s: unknown) => s },
}));
jest.mock('../service', () => ({
  getAnchorSnapshot: () => mockSnapshot, subscribeAnchor: () => () => {}, loadAnchor: async () => {},
  editAnchor: (...args: unknown[]) => mockEdit(...args), armAnchor: jest.fn(), stopAnchor: jest.fn(),
}));
jest.mock('../notifications', () => ({ prepareNotifications: jest.fn(), notifyAlarm: jest.fn(), stopAlarmTest: jest.fn() }));
jest.mock('../../navigation/NavigationContext', () => ({ useNavigation: () => ({ enableGPS: jest.fn() }) }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('../../components/NativeMap', () => {
  const React = require('react');
  return { MapView: React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ setCamera: mockCamera }));
    return React.createElement('MapView', props);
  }), Marker: 'Marker', Circle: 'Circle' };
});
beforeEach(() => { jest.clearAllMocks(); jest.useRealTimers(); mockSnapshot.settings.anchor = null; mockSnapshot.fix = { latitude: 43, longitude: 16, source: 'phone', accuracy: 5, timestamp: Date.now() }; });
it('shows persisted chain and margin and saves comma decimal input', async () => {
  const view = render(<AnchorSettings onBack={() => {}} />);
  expect(view.getByLabelText('Chain out (m)').props.value).toBe('55');
  expect(view.getByLabelText('Extra margin (m)').props.value).toBe('12');
  fireEvent.changeText(view.getByLabelText('Chain out (m)'), '63,5');
  fireEvent.press(view.getByText('Save chain and margin'));
  await waitFor(() => expect(mockEdit).toHaveBeenCalledWith({ chainM: 63.5, marginM: 12 }));
});
it('Anchor dropped saves the current reliable position', async () => {
  const view = render(<AnchorSettings onBack={() => {}} />);
  fireEvent.press(view.getByText('Anchor dropped'));
  await waitFor(() => expect(mockEdit).toHaveBeenCalledWith({ anchor: { latitude: 43, longitude: 16 } }));
});
it('map edits stay a draft until the user saves', async () => {
  const view = render(<AnchorSettings onBack={() => {}} />);
  fireEvent.press(view.getByText('Edit anchor on map'));
  expect(view.getByLabelText('Anchor target')).toBeTruthy();
  const map = view.UNSAFE_getByType('MapView' as any);
  fireEvent(map, 'regionChange', { latitude: 44, longitude: 17, latitudeDelta: 0.003, longitudeDelta: 0.003 });
  fireEvent.press(view.getByText('Save anchor position'));
  expect(mockEdit).not.toHaveBeenCalled();
  fireEvent(map, 'regionChangeComplete', { latitude: 44, longitude: 17, latitudeDelta: 0.003, longitudeDelta: 0.003 });
  expect(mockEdit).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Save anchor position'));
  await waitFor(() => expect(mockEdit).toHaveBeenCalledWith({ anchor: { latitude: 44, longitude: 17 } }));
});

it('cancels a panned map without saving a new anchor', () => {
  const view = render(<AnchorSettings onBack={() => {}} />);
  fireEvent.press(view.getByText('Edit anchor on map'));
  fireEvent(view.UNSAFE_getByType('MapView' as any), 'regionChangeComplete', { latitude: 44, longitude: 17 });
  fireEvent.press(view.getByText('Cancel'));
  expect(mockEdit).not.toHaveBeenCalled();
  expect(view.queryByLabelText('Anchor target')).toBeNull();
});

it('explains missing GPS even when an anchor is saved on the map', () => {
  mockSnapshot.settings.anchor = { latitude: 43, longitude: 16 };
  mockSnapshot.fix = null;
  const view = render(<AnchorSettings onBack={() => {}} />);
  expect(view.getByText('Waiting for a current boat GPS position. Phone accuracy must be 50 m or better. Placing the anchor on the map does not set the boat position.')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Start anchor alarm' }).props.accessibilityState.disabled).toBe(true);
});
it('allows starting with equivalent numeric formatting and explains genuinely unsaved changes', () => {
  mockSnapshot.settings.anchor = { latitude: 43, longitude: 16 };
  const view = render(<AnchorSettings onBack={() => {}} />);
  fireEvent.changeText(view.getByLabelText('Chain out (m)'), '55,0');
  fireEvent.changeText(view.getByLabelText('Extra margin (m)'), '12.00');
  expect(view.getByRole('button', { name: 'Start anchor alarm' }).props.accessibilityState.disabled).toBe(false);
  fireEvent.changeText(view.getByLabelText('Chain out (m)'), '60');
  expect(view.getByText('Save the chain length and margin before starting.')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Start anchor alarm' }).props.accessibilityState.disabled).toBe(true);
});

it('follows new GPS positions, pauses on pan and never moves the anchor editing target', () => {
  mockSnapshot.settings.anchor = { latitude: 42, longitude: 15 };
  const view = render(<AnchorSettings onBack={() => {}} />);
  const map = () => view.UNSAFE_getByType('MapView' as any);
  expect(map().props.initialRegion.latitude).toBe(43);
  fireEvent(map(), 'mapReady');
  mockSnapshot.fix = { ...mockSnapshot.fix!, latitude: 43.001 };
  view.rerender(<AnchorSettings onBack={() => {}} />);
  expect(mockCamera.mock.lastCall[0].center.latitude).toBe(43.001);
  fireEvent(map(), 'panDrag');
  mockCamera.mockClear();
  mockSnapshot.fix = { ...mockSnapshot.fix!, latitude: 43.002 };
  view.rerender(<AnchorSettings onBack={() => {}} />);
  expect(mockCamera).not.toHaveBeenCalled();
  expect(view.UNSAFE_getAllByType('Marker' as any).find(m => m.props.title === 'Boat')?.props.coordinate.latitude).toBe(43.002);
  fireEvent.press(view.getByText('Show my position'));
  expect(mockCamera.mock.lastCall[0].center.latitude).toBe(43.002);
  fireEvent.press(view.getByText('Edit anchor on map'));
  fireEvent(map(), 'mapReady');
  mockCamera.mockClear();
  mockSnapshot.fix = { ...mockSnapshot.fix!, latitude: 43.003 };
  view.rerender(<AnchorSettings onBack={() => {}} />);
  expect(mockCamera).not.toHaveBeenCalled();
});
it('acknowledges the scheduled test, prevents resetting its delay, and stops only the test', async () => {
  jest.useFakeTimers();
  const view = render(<AnchorSettings onBack={() => {}} />);
  await act(async () => { fireEvent.press(view.getByText('Test alarm sound')); });
  expect(prepareNotifications).toHaveBeenCalledTimes(1);
  expect(notifyAlarm).toHaveBeenCalledWith(true, 'system');
  expect(view.getByText('Test alarm scheduled. It starts in five seconds. Lock your phone now.')).toBeTruthy();
  fireEvent.press(view.getByText('Test alarm sound'));
  expect(notifyAlarm).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.press(view.getByText('Stop test sound')); });
  expect(stopAlarmTest).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(5000));
  expect(view.getByText('Test alarm stopped.')).toBeTruthy();
});
it('shows native test failures beside the test controls', async () => {
  (notifyAlarm as jest.Mock).mockRejectedValueOnce(new Error('Native alarm scheduling failed'));
  const view = render(<AnchorSettings onBack={() => {}} />);
  fireEvent.press(view.getByText('Test alarm sound'));
  await waitFor(() => expect(view.getByRole('alert').props.children).toBe('Native alarm scheduling failed'));
  expect(view.queryByText('Test alarm scheduled. It starts in five seconds. Lock your phone now.')).toBeNull();
});
