import React from 'react';
const { act, create } = require('react-test-renderer');
import { useFollowCamera } from '../useFollowCamera';

it('stops all camera animations on pan and resumes on recenter', () => {
  const map = { current: { setCamera: jest.fn() } };
  function Harness({ follow, latitude = 43, heading = 90 }: { follow: boolean; latitude?: number; heading?: number }) {
    useFollowCamera(map, true, follow, heading, { latitude, longitude: 15 });
    return null;
  }
  let tree: ReturnType<typeof create>;
  act(() => { tree = create(React.createElement(Harness, { follow: true })); });
  expect(map.current.setCamera).toHaveBeenCalledTimes(1);
  map.current.setCamera.mockClear();
  act(() => { tree.update(React.createElement(Harness, { follow: false })); });
  // Position and course updates must not interrupt manual map gestures.
  act(() => { tree.update(React.createElement(Harness, { follow: false, latitude: 44, heading: 120 })); });
  act(() => { tree.update(React.createElement(Harness, { follow: false, latitude: 45, heading: 0 })); });
  expect(map.current.setCamera).not.toHaveBeenCalled();
  act(() => { tree.update(React.createElement(Harness, { follow: true, latitude: 45, heading: 120 })); });
  expect(map.current.setCamera).toHaveBeenCalledWith({ center: { latitude: 45, longitude: 15 }, heading: 120, pitch: 0 });
  act(() => { tree.unmount(); });
});
