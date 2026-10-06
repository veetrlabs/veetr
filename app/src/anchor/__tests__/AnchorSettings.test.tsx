import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { getAlarmTestState, notifyAlarm, prepareNotifications, stopAlarmTest } from '../notifications';
import AnchorSettings from '../AnchorSettings';
import { defaults, type Coordinate, type AnchorFix } from '../model';
const mockCamera = jest.fn();
const mockEdit = jest.fn().mockResolvedValue(undefined);
const mockSnapshot = { settings: { ...defaults, anchor: null as Coordinate | null, chainM: 55, marginM: 12 },
  fix: { latitude: 43, longitude: 16, source: 'phone', accuracy: 5, timestamp: Date.now() } as AnchorFix | null, ready: true, error: '' };
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', ScrollView: 'ScrollView', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity',
  Platform: { OS: 'ios', Version: '26.0' }, Alert: { alert: jest.fn() },
  StyleSheet: { absoluteFillObject: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }, create: (s: unknown) => s, flatten: (s: unknown) => s },
}));
jest.mock('../service', () => ({
  getAnchorSnapshot: () => mockSnapshot, subscribeAnchor: () => () => {}, loadAnchor: async () => {},
  editAnchor: (...args: unknown[]) => mockEdit(...args), armAnchor: jest.fn(), stopAnchor: jest.fn(),
}));
jest.mock('../notifications', () => ({ getAlarmTestState: jest.fn().mockResolvedValue('unknown'), prepareNotifications: jest.fn(), notifyAlarm: jest.fn(), stopAlarmTest: jest.fn() }));
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
beforeEach(() => { Object.assign(Platform, { OS: 'ios', Version: '26.0' }); jest.clearAllMocks(); jest.useRealTimers(); mockSnapshot.settings.anchor = null; mockSnapshot.fix = { latitude: 43, longitude: 16, source: 'phone', accuracy: 5, timestamp: Date.now() }; });
it('shows persisted chain and margin and saves comma decimal input', async () => {
  const view = render(<AnchorSettings onBack={() => {}} />);
  expect(view.getByLabelText('Chain out (m)').props.value).toBe('55');
  expect(view.getByLabelText('Extra margin (m)').props.value).toBe('12');
  fireEvent.changeText(view.getByLabelText('Chain out (m)'), '63,5');
  expect(view.queryByText('Save chain and margin')).toBeNull();
  expect(mockEdit).not.toHaveBeenCalled();
  fireEvent(view.getByLabelText('Chain out (m)'), 'blur');
  await waitFor(() => expect(mockEdit).toHaveBeenCalledWith({ chainM: 63.5 }));
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
  expect(view.getByText('Finish editing the chain length and margin before starting.')).toBeTruthy();
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
  expect(view.getByText('Allow about 10 seconds for the test alarm. Lock your phone now. Tap again to cancel.')).toBeTruthy();
  expect(view.queryByText('Test alarm sound')).toBeNull();
  act(() => jest.advanceTimersByTime(10000));
  expect(view.getByText('Test starting… allow about 10 seconds')).toBeTruthy();
  expect(notifyAlarm).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.press(view.getByText('Test starting… allow about 10 seconds')); });
  expect(stopAlarmTest).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(10000));
  expect(view.getByText('Test alarm stopped.')).toBeTruthy();
});
it('shows native test failures beside the test controls', async () => {
  (notifyAlarm as jest.Mock).mockRejectedValueOnce(new Error('Native alarm scheduling failed'));
  const view = render(<AnchorSettings onBack={() => {}} />);
  fireEvent.press(view.getByText('Test alarm sound'));
  await waitFor(() => expect(view.getByRole('alert').props.children).toBe('Native alarm scheduling failed'));
  expect(view.queryByText('Allow about 10 seconds for the test alarm. Lock your phone now. Tap again to cancel.')).toBeNull();
});

it('shows only Test initially and switches immediately while native preparation is pending', async () => {
  let finish!: () => void;
  (prepareNotifications as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const view = render(<AnchorSettings onBack={() => {}} />);
  expect(view.queryByText('Test starting… allow about 10 seconds')).toBeNull();
  fireEvent.press(view.getByText('Test alarm sound'));
  expect(view.queryByText('Test alarm sound')).toBeNull();
  expect(view.getByText('Test starting… allow about 10 seconds')).toBeTruthy();
  expect(view.getByText('Preparing test alarm…')).toBeTruthy();
  await act(async () => { finish(); });
  expect(view.getByRole('button', { name: 'Test starting… allow about 10 seconds' }).props.accessibilityState.disabled).toBe(false);
});
it('restores an existing native test and returns to Test after system dismissal', async () => {
  jest.useFakeTimers();
  (getAlarmTestState as jest.Mock).mockResolvedValue('alerting');
  const view = render(<AnchorSettings onBack={() => {}} />);
  await act(async () => {});
  expect(view.queryByText('Test starting… allow about 10 seconds')).toBeNull();
  expect(view.queryByText('Stop test sound')).toBeNull();
  expect(view.getByText('Use Stop on the iPhone alarm to end the test.')).toBeTruthy();
  (getAlarmTestState as jest.Mock).mockResolvedValue('idle');
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(view.queryByText('Test starting… allow about 10 seconds')).toBeNull();
  expect(view.getByText('Test alarm sound')).toBeTruthy();
  (getAlarmTestState as jest.Mock).mockResolvedValue('unknown');
});
it('keeps Stop available if native cancellation fails', async () => {
  (stopAlarmTest as jest.Mock).mockRejectedValueOnce(new Error('Could not stop alarm'));
  const view = render(<AnchorSettings onBack={() => {}} />);
  await act(async () => { fireEvent.press(view.getByText('Test alarm sound')); });
  await act(async () => { fireEvent.press(view.getByText('Test starting… allow about 10 seconds')); });
  expect(view.getByText('Could not stop alarm')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Test starting… allow about 10 seconds' }).props.accessibilityState.disabled).toBe(false);
});

it('explains quiet monitoring only while a reliable position is inside the radius', () => {
  mockSnapshot.settings.armed = true;
  mockSnapshot.settings.anchor = { latitude: 43, longitude: 16 };
  const view = render(<AnchorSettings onBack={() => {}} />);
  const message = 'Monitoring is on. The boat is inside the alarm radius, so no alarm is sounding.';
  expect(view.getByText(message)).toBeTruthy();
  mockSnapshot.fix = { ...mockSnapshot.fix!, latitude: 44 };
  view.rerender(<AnchorSettings onBack={() => {}} />);
  expect(view.queryByText(message)).toBeNull();
  mockSnapshot.settings.armed = false;
});

it('uses a sound selector with the current choice and saves selection without playing a test', async () => {
  const view = render(<AnchorSettings onBack={() => {}} />);
  const selector = view.getByRole('combobox', { name: 'Alarm sound' });
  expect(selector.props.accessibilityValue.text).toBe('System alarm sound');
  expect(view.queryByRole('button', { name: 'Siren' })).toBeNull();
  expect(view.queryByRole('radio', { name: 'Siren' })).toBeNull();
  fireEvent.press(selector);
  expect(view.getByRole('radio', { name: 'System alarm sound' }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(view.getByRole('radio', { name: 'Siren' }));
  await waitFor(() => expect(mockEdit).toHaveBeenCalledWith({ sound: 'siren' }));
  expect(view.queryByRole('radio', { name: 'Siren' })).toBeNull();
  expect(notifyAlarm).not.toHaveBeenCalled();
});

it('saves margin independently and keeps an invalid chain draft out of storage', async () => {
  const view = render(<AnchorSettings onBack={() => {}} />);
  fireEvent.changeText(view.getByLabelText('Chain out (m)'), '');
  fireEvent(view.getByLabelText('Chain out (m)'), 'blur');
  expect(mockEdit).not.toHaveBeenCalled();
  expect(view.getByText('Enter a chain length from 1 to 1000 m.')).toBeTruthy();
  fireEvent.changeText(view.getByLabelText('Extra margin (m)'), '18,5');
  fireEvent(view.getByLabelText('Extra margin (m)'), 'blur');
  await waitFor(() => expect(mockEdit).toHaveBeenCalledWith({ marginM: 18.5 }));
  expect(view.getByLabelText('Chain out (m)').props.value).toBe('');
});
it('shows a failed autosave beside the field and allows retry on blur', async () => {
  mockEdit.mockRejectedValueOnce(new Error('Could not save'));
  const view = render(<AnchorSettings onBack={() => {}} />);
  fireEvent.changeText(view.getByLabelText('Chain out (m)'), '60');
  fireEvent(view.getByLabelText('Chain out (m)'), 'blur');
  await waitFor(() => expect(view.getByText('Could not save')).toBeTruthy());
  expect(view.getByLabelText('Chain out (m)').props.value).toBe('60');
  fireEvent(view.getByLabelText('Chain out (m)'), 'blur');
  await waitFor(() => expect(view.queryByText('Could not save')).toBeNull());
  expect(mockEdit).toHaveBeenCalledTimes(2);
});

it('shows brief guidance without technical names or upgrade notes on supported iPhones', () => {
  const view = render(<AnchorSettings onBack={() => {}} />);
  expect(view.getByText('Keep your phone aboard and charged.')).toBeTruthy();
  expect(view.queryByText(/AlarmKit/)).toBeNull();
  expect(view.queryByText('Anchor alarms need iOS 26 or later.')).toBeNull();
  expect(view.queryByText('To update: iPhone Settings → General → Software Update.')).toBeNull();
});
it('explains how to update an older iPhone and disables unsupported alarm actions', () => {
  Object.assign(Platform, { Version: '18.7.1' });
  mockSnapshot.settings.anchor = { latitude: 43, longitude: 16 };
  const view = render(<AnchorSettings onBack={() => {}} />);
  expect(view.getByText('Anchor alarms need iOS 26 or later.')).toBeTruthy();
  expect(view.getByText('To update: iPhone Settings → General → Software Update.')).toBeTruthy();
  expect(view.getByText('If your iPhone cannot update to iOS 26, use a phone that supports anchor alarms.')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Test alarm sound' }).props.accessibilityState.disabled).toBe(true);
  expect(view.getByRole('button', { name: 'Start anchor alarm' }).props.accessibilityState.disabled).toBe(true);
});
it('keeps Android guidance relevant to Android rather than showing iPhone upgrade notes', () => {
  Object.assign(Platform, { OS: 'android', Version: 35 });
  const view = render(<AnchorSettings onBack={() => {}} />);
  expect(view.getByText('Turn up Alarm volume and allow alarms in Do Not Disturb.')).toBeTruthy();
  expect(view.queryByText('Anchor alarms need iOS 26 or later.')).toBeNull();
});
