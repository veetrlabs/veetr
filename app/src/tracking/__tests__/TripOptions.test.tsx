import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TripOptions } from '../TripOptions';
import { trackingClient } from '../client';
let mockAuthChange: (event: string, session: unknown) => void;
jest.mock('../client', () => ({ trackingClient: { auth: {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn((callback) => {
    mockAuthChange = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
} } }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (fn: any) => require('react').useEffect(fn, [fn]) }));
jest.mock('react-native', () => ({ Text: 'Text', View: 'View', TextInput: 'TextInput', Pressable: 'View', StyleSheet: { flatten: (s: unknown) => s } }));
const setup = () => {
  const onVisibility = jest.fn();
  return { onVisibility, ...render(<TripOptions title="Trip" onTitle={jest.fn()} visibility="private" onVisibility={onVisibility} />) };
};
test('signed out users retain Private and must sign in to enable sharing', async () => {
  (trackingClient!.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
  const ui = setup();
  await waitFor(() => expect(ui.getByText(/Sign in to share trips/)).toBeTruthy());
  expect(ui.getByLabelText('Private').props.accessibilityState).toEqual({ checked: true, disabled: false });
  for (const label of ['Anyone with the link', 'Public']) {
    expect(ui.getByLabelText(label).props.disabled).toBe(true);
    fireEvent.press(ui.getByLabelText(label));
  }
  expect(ui.onVisibility).not.toHaveBeenCalled();
  act(() => mockAuthChange('SIGNED_IN', { user: { id: 'one' } }));
  expect(ui.queryByText(/Sign in to share trips/)).toBeNull();
  fireEvent.press(ui.getByLabelText('Public'));
  expect(ui.onVisibility).toHaveBeenCalledWith('public');
});
test('existing sessions enable sharing and sign-out disables it', async () => {
  (trackingClient!.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'one' } } } });
  const ui = setup();
  await waitFor(() => expect(ui.getByLabelText('Public').props.disabled).toBe(false));
  expect(ui.queryByText(/Sign in to share trips/)).toBeNull();
  act(() => mockAuthChange('SIGNED_OUT', null));
  expect(ui.getByLabelText('Public').props.disabled).toBe(true);
  expect(ui.getByText(/Sign in to share trips/)).toBeTruthy();
});
test('a failed session check still offers sign in', async () => {
  (trackingClient!.auth.getSession as jest.Mock).mockRejectedValue(new Error('offline'));
  const ui = setup();
  await waitFor(() => expect(ui.getByText(/Sign in to share trips/)).toBeTruthy());
  expect(ui.getByLabelText('Public').props.disabled).toBe(true);
});
