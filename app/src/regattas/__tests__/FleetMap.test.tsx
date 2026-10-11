import React from 'react';
import { render } from '@testing-library/react-native';
import FleetMap from '../FleetMap';
jest.mock('../../components/NativeMap', () => ({
  MapView: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({ fitToCoordinates: jest.fn() }));
    return require('react').createElement('View', { ...props, testID: 'native-map' });
  }), Polyline: 'View', UrlTile: 'View',
}));
jest.mock('../../maps/BoatMarker', () => () => null);
jest.mock('../../maps/CourseLayer', () => ({ __esModule: true, default: () => null, courseCoordinates: () => [] }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('react-native', () => ({ Text: 'Text', View: 'View', StyleSheet: { flatten: (s: any) => s } }));
test('waits for coordinates then mounts directly at the Croatian recording', () => {
  const ui = render(<FleetMap positions={[]} at={0} loading />);
  expect(ui.queryByTestId('native-map')).toBeNull();
  expect(ui.getByText('Loading competitors…')).toBeTruthy();
  ui.rerender(<FleetMap positions={[{ boatId: 'boat', boatName: 'Boat', latitude: 43.75, longitude: 15.7, recordedAt: new Date(0).toISOString(), sogMps: null, trail: [] } as any]} at={0} />);
  expect(ui.getByTestId('native-map').props.initialRegion).toMatchObject({ latitude: 43.75, longitude: 15.7 });
});
test('empty recordings show an empty state, not an unrelated map', () => {
  const ui = render(<FleetMap positions={[]} at={0} />);
  expect(ui.queryByTestId('native-map')).toBeNull();
  expect(ui.getByText('No GPS positions')).toBeTruthy();
});
