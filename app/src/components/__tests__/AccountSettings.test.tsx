import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AccountSettings from '../AccountSettings';
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', Pressable: 'Pressable',
  Linking: { openURL: jest.fn() },
  StyleSheet: { flatten: (style: unknown) => Array.isArray(style) ? Object.assign({}, ...style) : style },
}));
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockStoreGet = jest.fn();
const mockPush = jest.fn();
let mockAuthChanged: (event: string, session: unknown) => void;
jest.mock('../../tracking/client', () => ({ trackingClient: { auth: {
  getSession: () => mockGetSession(),
  signInWithPassword: (input: unknown) => mockSignIn(input),
  signOut: (input: unknown) => mockSignOut(input),
  onAuthStateChange: (callback: typeof mockAuthChanged) => { mockAuthChanged = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; },
} } }));
jest.mock('../../tracking/service', () => ({ resumeTracking: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../tracking/database', () => ({ trackingStore: async () => ({ get: () => mockStoreGet() }) }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockSignIn.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockStoreGet.mockResolvedValue(null);
});
test('Settings account signs in with the shared client and opens live sharing', async () => {
  const ui = render(<AccountSettings onBack={jest.fn()} />);
  await ui.findByLabelText('Email');
  fireEvent.changeText(ui.getByLabelText('Email'), ' skipper@example.test ');
  fireEvent.changeText(ui.getByLabelText('Password'), 'test-password');
  fireEvent.press(ui.getByText('Sign in'));
  await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({ email: 'skipper@example.test', password: 'test-password' }));
  await act(async () => mockAuthChanged('SIGNED_IN', { user: { id: 'skipper', email: 'skipper@example.test' } }));
  expect(ui.getByText('Signed in as skipper@example.test')).toBeTruthy();
  fireEvent.press(ui.getByText('Share boat location →'));
  expect(mockPush).toHaveBeenCalledWith('/regatta-sharing');
});
test('an unfinished shared tracking session blocks Settings sign-out', async () => {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'skipper', email: 'skipper@example.test' } } } });
  mockStoreGet.mockResolvedValue({ userId: 'skipper', mode: 'shared', phase: 'recording' });
  const ui = render(<AccountSettings onBack={jest.fn()} />);
  fireEvent.press(await ui.findByText('Sign out'));
  expect(await ui.findByText('Finish live sharing in Regattas before signing out.')).toBeTruthy();
  expect(mockSignOut).not.toHaveBeenCalled();
});
test('sign-in failure stays visible on the account form', async () => {
  mockSignIn.mockResolvedValue({ error: new Error('Invalid login credentials') });
  const ui = render(<AccountSettings onBack={jest.fn()} />);
  fireEvent.changeText(await ui.findByLabelText('Email'), 'skipper@example.test');
  fireEvent.changeText(ui.getByLabelText('Password'), 'wrong');
  fireEvent.press(ui.getByText('Sign in'));
  expect(await ui.findByText('Invalid login credentials')).toBeTruthy();
});
