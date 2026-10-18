import React from 'react';
import { View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import TripMap from '../TripMap';
const mockFit = jest.fn();
jest.mock('../../components/NativeMap', () => ({
  MapView: require('react').forwardRef((props: any, ref: any) => {
    require('react').useImperativeHandle(ref, () => ({ fitToCoordinates: mockFit }));
    return require('react').createElement('View', {...props, testID:'map'});
  }), Marker:'View', Polyline:'View',
}));
jest.mock('../../maps/BoatMarker', () => () => null);
jest.mock('../../maps/CourseLayer', () => ({
  __esModule:true, default:()=>null, courseCoordinates:(course:any)=>course?.marks ?? [],
}));
jest.mock('../../context/ThemeContext', () => ({useTheme:()=>({theme:'light'})}));
jest.mock('react-native', () => ({Text:'Text',View:'View',StyleSheet:{flatten:(s:any)=>s}}));
beforeEach(()=>mockFit.mockClear());
const course = () => ({marks:[{latitude:49.68,longitude:14.01},{latitude:49.69,longitude:14.02}]} as any);

test('polling fresh course objects preserves the user zoom after initial map fit', () => {
  const ui=render(<TripMap points={[]} course={course()} />);
  expect(mockFit).not.toHaveBeenCalled();
  fireEvent(ui.getByTestId('map'),'mapReady');
  expect(mockFit).toHaveBeenCalledTimes(1);
  fireEvent(ui.getByTestId('map'),'regionChangeComplete',{latitude:49.68,longitude:14.01,latitudeDelta:.001,longitudeDelta:.001});
  for(let i=0;i<5;i++)ui.rerender(<TripMap points={[]} course={course()} />);
  expect(mockFit).toHaveBeenCalledTimes(1);
  fireEvent(ui.getByTestId('map'),'mapReady');
  expect(mockFit).toHaveBeenCalledTimes(1);
});
test('late course data gets an initial fit and another race fits independently', () => {
  const ui=render(<View><TripMap key="one" points={[]} /></View>);
  expect(ui.queryByTestId('map')).toBeNull();
  ui.rerender(<View><TripMap key="one" points={[]} course={course()} /></View>);
  fireEvent(ui.getByTestId('map'),'mapReady');
  expect(mockFit).toHaveBeenCalledTimes(1);
  ui.rerender(<View><TripMap key="two" points={[]} course={course()} /></View>);
  fireEvent(ui.getByTestId('map'),'mapReady');
  expect(mockFit).toHaveBeenCalledTimes(2);
});
test('noninteractive thumbnails still fit updated contents', () => {
  const ui=render(<TripMap points={[]} course={course()} thumbnail />);
  fireEvent(ui.getByTestId('map'),'mapReady');
  ui.rerender(<TripMap points={[]} course={course()} thumbnail />);
  expect(mockFit).toHaveBeenCalledTimes(2);
});
