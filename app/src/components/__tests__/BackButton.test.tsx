import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BackButton from '../BackButton';
jest.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', StyleSheet: { flatten: (s: unknown) => s } }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
test('back navigation has a named button, generous tap target and calls its screen destination', () => {
  const back = jest.fn();
  const ui = render(<BackButton onPress={back} />);
  const button = ui.getByRole('button', { name: 'Back' });
  expect(button.props.style({ pressed: false })).toMatchObject({ minHeight: 44, minWidth: 44 });
  fireEvent.press(button);
  expect(back).toHaveBeenCalledTimes(1);
});
